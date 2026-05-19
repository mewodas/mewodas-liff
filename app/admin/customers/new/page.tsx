'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UserPlus,
  Target,
  ClipboardList,
  Calculator,
  Hourglass,
  ClipboardCopy,
  Check,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import AdminShell from '../../AdminShell';
import { ACTIVITY_LEVELS, calcGoals, daysUntil } from '@/lib/goalCalc';
import { useAdminBase } from '@/lib/useAdminBase';

type StoreItem = { pageId: string; storeId: string; name: string };
type CreatedCustomer = { pageId: string; name: string };

const STATUS_OPTIONS = ['設定中', '進行中', '休止中', '卒業'];
const GENDER_OPTIONS = ['男性', '女性'];

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function InvitePanel({ customer, base, seatBlocked }: { customer: CreatedCustomer; base: string; seatBlocked: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (seatBlocked) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${customer.pageId}/invite-link`, { method: 'POST' });
        if (!res.ok) throw new Error('リンク生成失敗');
        const j = await res.json();
        setInviteUrl(j.url);
        setShareText(j.shareText || j.url);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'エラー');
      }
    })();
  }, [customer.pageId, seatBlocked]);

  async function copyLink() {
    if (!shareText) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // ignore
    } finally {
      setCopying(false);
    }
  }

  const lineUrl = inviteUrl ? `https://line.me/R/msg/text/?${encodeURIComponent(shareText || inviteUrl)}` : null;

  return (
    <div className="space-y-3">
      <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-2">
        <div className="text-sm font-bold text-emerald-900">
          {customer.name} 様の登録が完了しました
        </div>
        <p className="text-xs text-emerald-800 leading-relaxed">
          次のステップ: 招待リンクを LINE で送信してください。顧客が初回アクセスすると LINE アカウントが自動で紐付けられます。
        </p>
      </div>

      {seatBlocked && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-xl inline-flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" strokeWidth={2.2} />
          <div>
            <div className="font-bold">席数上限のため招待リンクを発行できません</div>
            <Link href={`${base}/billing`} className="text-rose-700 font-bold underline mt-1 inline-block">
              増枠する →
            </Link>
          </div>
        </div>
      )}

      {loadError && (
        <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{loadError}</div>
      )}

      {!seatBlocked && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <ClipboardCopy className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
            招待リンクを送る
          </h3>

          {!inviteUrl && !loadError && (
            <div className="text-xs text-stone-500">リンク生成中…</div>
          )}

          {inviteUrl && (
            <>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="text-[11px] text-stone-500 mb-1">送信テキスト（案内文込み）</p>
                <pre className="text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">{shareText}</pre>
              </div>

              <button
                type="button"
                onClick={copyLink}
                disabled={copying}
                className="w-full bg-sky-500 text-white font-bold py-3 rounded-xl active:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" strokeWidth={2.4} />
                    コピーしました
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="w-4 h-4" strokeWidth={2.4} />
                    {copying ? 'コピー中…' : '招待リンクをコピー（案内文付き）'}
                  </>
                )}
              </button>

              {lineUrl && (
                <a
                  href={lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#06C755] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.477 2 2 6.033 2 11c0 3.491 2.115 6.532 5.29 8.255-.073.694-.278 2.202-.319 2.542-.05.408.15.405.316.295.13-.088 1.7-1.137 2.393-1.6.753.103 1.525.158 2.32.158 5.523 0 10-4.033 10-9 0-4.967-4.477-9-10-9z" />
                  </svg>
                  LINE で送る
                </a>
              )}

              <p className="text-[11px] text-stone-500 leading-relaxed">
                ※ 招待リンクの有効期限は30日間です。期限切れの場合は顧客詳細画面から再発行できます。
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] p-2.5 rounded-lg leading-relaxed">
                <span className="font-bold">⚠ 14日ルール:</span> 招待リンクが利用されないまま「設定中」が <strong>14日経過</strong>すると、毎日 03:00 (JST) の自動クリーンアップで <strong>削除</strong>されます。早めに送付してください。
              </div>
            </>
          )}
        </div>
      )}

      <Link
        href={`${base}/customers/${customer.pageId}`}
        className="w-full bg-stone-100 text-stone-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm border border-stone-200"
      >
        顧客詳細を見る
        <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
      </Link>

      <Link
        href={base}
        className="block text-center text-xs text-stone-500 underline py-1"
      >
        顧客一覧に戻る
      </Link>
    </div>
  );
}

export default function NewCustomerPage() {
  const base = useAdminBase();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
  const today = jstToday();

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [name, setName] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [foodStatus, setFoodStatus] = useState('設定中');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [plan, setPlan] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [storeId, setStoreId] = useState('');

  const [goalKcal, setGoalKcal] = useState('');
  const [goalP, setGoalP] = useState('');
  const [goalF, setGoalF] = useState('');
  const [goalC, setGoalC] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seatBlocked, setSeatBlocked] = useState(false);
  const [created, setCreated] = useState<CreatedCustomer | null>(null);

  useEffect(() => {
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list: StoreItem[] = j?.stores || [];
        setStores(list);
        if (list.length === 1) setStoreId(list[0].storeId);
      })
      .catch(() => {});
    fetch('/api/admin/billing/info', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && !j.error && j.isOverLimit) setSeatBlocked(true);
      })
      .catch(() => {});
  }, []);

  const calc = useMemo(() => {
    return calcGoals({
      gender: gender || null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      age: age ? parseInt(age, 10) : null,
      activityLevel: activityLevel || null,
      plan: plan || null,
      currentWeight: currentWeight ? parseFloat(currentWeight) : null,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      targetDate: targetDate || null,
      today,
    });
  }, [gender, heightCm, age, activityLevel, plan, currentWeight, targetWeight, targetDate, today]);

  const remainingDays = useMemo(() => {
    if (!targetDate) return null;
    return daysUntil(targetDate, today);
  }, [targetDate, today]);

  useEffect(() => {
    if (!calc) return;
    setGoalKcal(String(calc.goalKcal));
    setGoalP(String(calc.goalP));
    setGoalF(String(calc.goalF));
    setGoalC(String(calc.goalC));
  }, [calc]);

  const pRatio = useMemo(() => {
    const k = parseFloat(goalKcal);
    const p = parseFloat(goalP);
    if (!k || k === 0) return null;
    return Math.round((p * 4 / k) * 100);
  }, [goalKcal, goalP]);

  const fRatioCalc = useMemo(() => {
    const k = parseFloat(goalKcal);
    const f = parseFloat(goalF);
    if (!k || k === 0) return null;
    return Math.round((f * 9 / k) * 100);
  }, [goalKcal, goalF]);

  const cRatio = useMemo(() => {
    const k = parseFloat(goalKcal);
    const c = parseFloat(goalC);
    if (!k || k === 0) return null;
    return Math.round((c * 4 / k) * 100);
  }, [goalKcal, goalC]);

  async function save() {
    if (!name.trim()) {
      setError('氏名は必須です');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        lineUserId: lineUserId.trim() || undefined,
        foodStatus,
        gender: gender || undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        age: age ? parseInt(age, 10) : undefined,
        activityLevel: activityLevel || undefined,
        plan: plan || undefined,
        currentWeight: currentWeight ? parseFloat(currentWeight) : undefined,
        targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
        targetDate: targetDate || undefined,
        goals: (goalKcal || goalP || goalF || goalC)
          ? {
              kcal: parseInt(goalKcal, 10) || 0,
              P: parseFloat(goalP) || 0,
              F: parseFloat(goalF) || 0,
              C: parseFloat(goalC) || 0,
            }
          : undefined,
        storeId: storeId || undefined,
      };
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `作成失敗（${res.status}）`);
      }
      const j = await res.json();
      setCreated({ pageId: j.customer.pageId, name: name.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <AdminShell title="顧客追加完了" back={{ href: base }}>
        <InvitePanel customer={created} base={base} seatBlocked={seatBlocked} />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="新規顧客追加" back={{ href: base }}>
      <div className="space-y-3">
        {seatBlocked && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-xl inline-flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" strokeWidth={2.2} />
            <div>
              <div className="font-bold">席数上限に達しているため新規顧客を追加できません</div>
              <Link href={`${base}/billing`} className="text-rose-700 font-bold underline mt-1 inline-block">
                増枠する →
              </Link>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {/* 基本情報 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
            基本情報
          </h2>
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              氏名（必須）
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 花子"
              className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                ステータス
              </label>
              <select
                value={foodStatus}
                onChange={(e) => setFoodStatus(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                所属店舗
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {stores.map((s) => <option key={s.storeId} value={s.storeId}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              LINEユーザーID
            </label>
            <input
              type="text"
              value={lineUserId}
              onChange={(e) => isAdminRoute && setLineUserId(e.target.value)}
              readOnly={!isAdminRoute}
              placeholder="顧客が初回LIFF起動時に自動取得（事前に分かっていれば入力）"
              className={`w-full border rounded-xl p-2.5 text-base focus:outline-none ${
                isAdminRoute
                  ? 'bg-white border-stone-300 focus:ring-2 focus:ring-emerald-500'
                  : 'bg-stone-100 border-stone-200 text-stone-500 cursor-not-allowed'
              }`}
            />
            <div className="text-xs text-stone-500 mt-0.5">
              {isAdminRoute
                ? '通常は空のまま保存。顧客が LIFF を起動すれば自動で紐付け'
                : 'LINEユーザーIDは顧客が LIFF を起動すると自動紐付けされます（編集不可）'}
            </div>
          </div>
        </section>

        {/* 身体情報 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
            身体情報
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                性別
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <NumInput label="年齢" value={age} onChange={setAge} step="1" suffix="歳" />
            <NumInput label="身長" value={heightCm} onChange={setHeightCm} step="0.1" suffix="cm" />
            <NumInput label="現在体重" value={currentWeight} onChange={setCurrentWeight} step="0.1" suffix="kg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                活動レベル
              </label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {ACTIVITY_LEVELS.map((a) => <option key={a.label} value={a.label}>{a.displayLabel}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                希望のプラン
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                <option value="減量">減量</option>
                <option value="増量">増量</option>
                <option value="筋肥大">筋肥大</option>
                <option value="現状維持">現状維持</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-stone-500 leading-snug">
            ※ 性別・年齢・身長・現在体重・活動レベル・希望のプランを入力すると、目標カロリーとPFCが自動計算されます（手動編集可）。
          </div>
        </section>

        {/* 目標 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            目標
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                目標体重
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">kg</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                目標達成日
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {targetDate && remainingDays !== null && (
            <div className="rounded-xl border bg-sky-50 border-sky-200 text-sky-800 p-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                <span className="text-xs font-bold whitespace-nowrap">
                  {remainingDays < 0 ? `目標日を ${Math.abs(remainingDays)} 日超過`
                   : remainingDays === 0 ? '目標日は今日'
                   : `目標まであと ${remainingDays} 日`}
                </span>
                {currentWeight && targetWeight && (() => {
                  const cw = parseFloat(currentWeight);
                  const tw = parseFloat(targetWeight);
                  if (isNaN(cw) || isNaN(tw)) return null;
                  const diff = tw - cw;
                  const weightLabel = diff < 0
                    ? `あと ${Math.abs(diff).toFixed(1)}kg 減量`
                    : diff > 0
                    ? `あと ${diff.toFixed(1)}kg 増量`
                    : '現体重キープ';
                  const rawDelta = calc?.dailyDeltaKcal;
                  const isUnsafeDeficit = calc?.isUnsafeDeficit ?? false;
                  const isUnsafeSurplus = calc?.isUnsafeSurplus ?? false;
                  const isUnsafeGoalKcal = calc?.isUnsafeGoalKcal ?? false;
                  return (
                    <>
                      <span className="text-xs font-bold whitespace-nowrap">／ {weightLabel}</span>
                      {rawDelta !== undefined && rawDelta !== 0 && (
                        <span className="text-xs font-bold whitespace-nowrap">
                          {rawDelta < 0 ? `／ 1日あたり ${rawDelta} kcal 削減` : `／ 1日あたり +${rawDelta} kcal 追加`}
                        </span>
                      )}
                      {(isUnsafeDeficit || isUnsafeSurplus || isUnsafeGoalKcal) && (() => {
                        const parts: string[] = [];
                        if (isUnsafeDeficit) parts.push(`1日あたり ${Math.round(rawDelta ?? 0)} kcal の${rawDelta && rawDelta < 0 ? '削減' : '追加'}は安全上限（±1,000 kcal/日）を超えています`);
                        if (isUnsafeSurplus && !isUnsafeDeficit) parts.push(`1日あたり +${Math.round(rawDelta ?? 0)} kcal の追加は安全上限（+1,000 kcal/日）を超えています`);
                        if (isUnsafeGoalKcal) parts.push('目標カロリーが安全レンジ（1,200〜4,000 kcal）外です');
                        return (
                          <div className="w-full mt-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 leading-snug space-y-1">
                            <p>⚠️ 健康上の安全範囲を超えています：{parts.join('、')}。</p>
                            <p>過度な減量／増量は健康リスクあり。目標日や体重の見直しを推奨します（トレーナー判断で保存も可）。</p>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
                {(!currentWeight || !targetWeight) && (
                  <span className="text-[11px] opacity-70">目標体重を入力すると1日あたり kcal が計算されます</span>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">現在の消費カロリー</label>
                <div className="relative w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center text-stone-700">
                  {calc?.tdee ?? '—'}
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400">kcal</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標カロリー</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    inputMode="decimal"
                    value={goalKcal}
                    onChange={(e) => setGoalKcal(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">kcal</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質（g）</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalP}
                    onChange={(e) => setGoalP(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">g</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質（％）</label>
                <div className="relative w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center text-stone-700">
                  {pRatio !== null ? pRatio : '—'}
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質（g）</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalF}
                    onChange={(e) => setGoalF(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">g</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質（％）</label>
                <div className="relative w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center text-stone-700">
                  {fRatioCalc !== null ? fRatioCalc : '—'}
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物（g）</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalC}
                    onChange={(e) => setGoalC(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">g</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物（％）</label>
                <div className="relative w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center text-stone-700">
                  {cRatio !== null ? cRatio : '—'}
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim() || seatBlocked}
          className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" strokeWidth={2.2} />
          {saving ? '作成中…' : seatBlocked ? '席数上限のため追加不可' : '顧客を作成'}
        </button>
      </div>
    </AdminShell>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step = '1',
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-stone-700 mb-1 block">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          step={step}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {suffix && (
          <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}
