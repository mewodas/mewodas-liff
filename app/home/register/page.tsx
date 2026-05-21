'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getIdToken, refreshLiff } from '@/lib/liff';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500">
          読み込み中…
        </div>
      }
    >
      <RegisterInner />
    </Suspense>
  );
}

const ACTIVITY_OPTIONS = ['低い（ほぼ運動なし）', '中程度', '高い（毎日運動）'];
const GENDER_OPTIONS = ['男性', '女性', 'その他'];
const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 101 }, (_, i) => CURRENT_YEAR - i);
const TARGET_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type Phase = 'liff-init' | 'form' | 'submitting' | 'done' | 'already-registered' | 'error';

function RegisterInner() {
  const sp = useSearchParams();
  const tenantId = sp.get('tenantId') || '';

  const [phase, setPhase] = useState<Phase>('liff-init');
  const [liffId, setLiffId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInClient, setIsInClient] = useState(false);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDateYear, setTargetDateYear] = useState('');
  const [targetDateMonth, setTargetDateMonth] = useState('');
  const [targetDateDay, setTargetDateDay] = useState('');
  const [activityLevel, setActivityLevel] = useState('');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [officialLineUrl, setOfficialLineUrl] = useState('');

  // 選択中の年月に応じた日数（うるう年・月末を考慮）
  const daysInSelectedMonth =
    birthYear && birthMonth
      ? new Date(Number(birthYear), Number(birthMonth), 0).getDate()
      : 31;
  const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

  const daysInTargetMonth =
    targetDateYear && targetDateMonth
      ? new Date(Number(targetDateYear), Number(targetDateMonth), 0).getDate()
      : 31;
  const targetDayOptions = Array.from({ length: daysInTargetMonth }, (_, i) => i + 1);

  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;
        const id = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!id) throw new Error('LIFF ID 未設定');
        await liff.init({ liffId: id });
        setLiffId(id);
        setIsInClient(liff.isInClient());

        if (!liff.isLoggedIn()) {
          liff.login({
            redirectUri: `${window.location.origin}/home/register${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`,
          });
          return;
        }
        setPhase('form');
      } catch (e) {
        setInitError(e instanceof Error ? e.message : 'LIFF初期化エラー');
        setPhase('error');
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !heightCm || !currentWeight) {
      setSubmitError('必須項目を入力してください');
      return;
    }
    setPhase('submitting');
    setSubmitError(null);

    try {
      const birthdate =
        birthYear && birthMonth && birthDay
          ? `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
          : undefined;

      const targetDate =
        targetDateYear && targetDateMonth && targetDateDay
          ? `${targetDateYear}-${String(targetDateMonth).padStart(2, '0')}-${String(targetDateDay).padStart(2, '0')}`
          : undefined;

      const bodyPayload = JSON.stringify({
        name: name.trim(),
        gender: gender || undefined,
        birthdate,
        heightCm: parseFloat(heightCm),
        currentWeight: parseFloat(currentWeight),
        targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
        targetDate,
        activityLevel: activityLevel || undefined,
      });

      const doRequest = async (token: string): Promise<Response> => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        if (liffId) headers['x-liff-id'] = liffId;
        if (tenantId) headers['x-tenant-id'] = tenantId;
        return fetch('/api/liff/register', { method: 'POST', headers, body: bodyPayload });
      };

      let idToken = await getIdToken();
      if (!idToken) throw new Error('LINE IDトークンの取得に失敗しました');

      let res = await doRequest(idToken);

      // IDトークン期限切れの場合: refreshLiff で再取得して1回リトライ
      if (res.status === 401) {
        await refreshLiff();
        const refreshed = await getIdToken();
        if (refreshed && refreshed !== idToken) {
          res = await doRequest(refreshed);
        }
      }

      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '登録に失敗しました');

      setCustomerName(j.customerName || '');
      setOfficialLineUrl(j.officialLineUrl || '');
      setPhase(j.alreadyRegistered ? 'already-registered' : 'done');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'エラーが発生しました');
      setPhase('form');
    }
  }

  if (phase === 'liff-init') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-600 font-bold">LINE認証中…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 gap-5 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-stone-900">アクセスエラー</p>
          <p className="text-sm text-stone-600 mt-2 leading-relaxed">{initError}</p>
          {!isInClient && (
            <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
              このフォームはLINEのトーク内から開いてください。
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'already-registered') {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 gap-6 text-center">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-bold text-stone-900">
            {customerName ? `${customerName}様` : ''}は登録済みです
          </p>
          <p className="text-sm text-stone-600 mt-3 leading-relaxed">
            すでにアカウントが作成されています。
            <br />
            このウィンドウを閉じてリッチメニューからご利用ください。
          </p>
        </div>
        {officialLineUrl && (
          <a
            href={officialLineUrl}
            className="block w-full max-w-sm bg-[#06C755] text-white text-center font-bold py-3.5 rounded-2xl text-sm"
          >
            公式LINEを友だち追加する
          </a>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 gap-6 text-center">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-bold text-stone-900">
            {customerName ? `${customerName}様` : ''}　登録完了しました
          </p>
          <p className="text-sm text-stone-600 mt-3 leading-relaxed">
            食事管理プログラムへようこそ。
          </p>
        </div>

        {officialLineUrl ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-2">
              <p className="text-sm font-bold text-stone-900">公式LINEを友だち追加してください</p>
              <p className="text-xs text-stone-600 leading-relaxed">
                下のボタンから公式LINEを友だち追加していただくと、
                <br />
                リッチメニューから食事管理のURLにアクセス可能です。
              </p>
            </div>
            <a
              href={officialLineUrl}
              className="block w-full bg-[#06C755] text-white text-center font-bold py-3.5 rounded-2xl text-sm"
            >
              公式LINEを友だち追加する
            </a>
          </div>
        ) : (
          <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
            トレーナーから次のステップをご案内します。
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-10">
      <div className="bg-emerald-600 text-white px-4 py-5">
        <h1 className="text-lg font-bold">食事管理サービス 申し込みフォーム</h1>
        <p className="text-xs text-emerald-100 mt-1">入力情報をもとに目標PFCを自動計算します</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 mt-5 space-y-4">
        {submitError && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-xl">
            {submitError}
          </div>
        )}

        <Section title="基本情報">
          <Field label="お名前" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              required
              className={inputCls}
            />
          </Field>
          <Field label="性別">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="生年月日">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className={inputCls}
                aria-label="生まれ年"
              >
                <option value="">年</option>
                {BIRTH_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className={inputCls}
                aria-label="生まれ月"
              >
                <option value="">月</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className={inputCls}
                aria-label="生まれ日"
              >
                <option value="">日</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </Field>
        </Section>

        <Section title="体型・目標">
          <Field label="身長 (cm)" required>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="100"
              max="250"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="170.0"
              required
              className={inputCls}
            />
          </Field>
          <Field label="現在体重 (kg)" required>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="300"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              placeholder="70.0"
              required
              className={inputCls}
            />
          </Field>
          <Field label="目標体重 (kg)">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="300"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="65.0"
              className={inputCls}
            />
          </Field>
          <Field label="目標達成日">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={targetDateYear}
                onChange={(e) => setTargetDateYear(e.target.value)}
                className={inputCls}
                aria-label="目標達成年"
              >
                <option value="">年</option>
                {TARGET_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={targetDateMonth}
                onChange={(e) => setTargetDateMonth(e.target.value)}
                className={inputCls}
                aria-label="目標達成月"
              >
                <option value="">月</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={targetDateDay}
                onChange={(e) => setTargetDateDay(e.target.value)}
                className={inputCls}
                aria-label="目標達成日"
              >
                <option value="">日</option>
                {targetDayOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="活動レベル">
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {ACTIVITY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </Section>

        <button
          type="submit"
          disabled={phase === 'submitting'}
          className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl text-base active:bg-emerald-700 disabled:opacity-50"
        >
          {phase === 'submitting' ? '登録中…' : '申し込む'}
        </button>
      </form>
    </div>
  );
}

const inputCls = 'w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-stone-700">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-stone-700 block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
