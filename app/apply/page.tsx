'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500">読み込み中…</div>}>
      <ApplyInner />
    </Suspense>
  );
}

const ACTIVITY_OPTIONS = ['低い（ほぼ運動なし）', '中程度', '高い（毎日運動）'];
const GENDER_OPTIONS = ['男性', '女性', 'その他'];

function ApplyInner() {
  const sp = useSearchParams();
  const tenantSlug = sp.get('tenant') || '';
  const tenantId = sp.get('tenantId') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [allergies, setAllergies] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !heightCm || !currentWeight || !targetWeight) {
      setError('必須項目を入力してください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/public/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          gender: gender || undefined,
          birthdate: birthdate || undefined,
          heightCm: parseFloat(heightCm),
          currentWeight: parseFloat(currentWeight),
          targetWeight: parseFloat(targetWeight),
          activityLevel: activityLevel || undefined,
          allergies: allergies.trim() || undefined,
          tenantSlug: tenantSlug || undefined,
          tenantId: tenantId || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '申込に失敗しました');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 gap-6 text-center">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-bold text-stone-900">申込ありがとうございます</p>
          <p className="text-sm text-stone-600 mt-3 leading-relaxed">
            LINE 公式アカウントに友だち追加後、
            <br />
            トレーナーから連絡が届きます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-10">
      <div className="bg-emerald-600 text-white px-4 py-5">
        <h1 className="text-lg font-bold">食事管理サービス 申込フォーム</h1>
        <p className="text-xs text-emerald-100 mt-1">入力内容はトレーナーが確認します</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 mt-5 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-xl">{error}</div>
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
          <Field label="メールアドレス" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className={inputCls}
            />
          </Field>
          <Field label="電話番号">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-0000-0000"
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
            <input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className={inputCls}
            />
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
          <Field label="目標体重 (kg)" required>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="300"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="65.0"
              required
              className={inputCls}
            />
          </Field>
          <Field label="活動レベル">
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {ACTIVITY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="食事・アレルギー">
          <Field label="食事制限・アレルギー">
            <textarea
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              rows={3}
              placeholder="例：卵アレルギー、乳製品不可など（任意）"
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl text-base active:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? '送信中…' : '申し込む'}
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
