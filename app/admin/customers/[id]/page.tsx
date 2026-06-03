'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Target,
  ClipboardList,
  Save,
  Calculator,
  Hourglass,
  Info,
  Circle,
  RotateCcw,
} from 'lucide-react';
import AdminShell from '../../AdminShell';
import { adminAccent } from '@/lib/adminAccent';
import { ACTIVITY_LEVELS, calcGoals, daysUntil } from '@/lib/goalCalc';
import { useAdminBase } from '@/lib/useAdminBase';
import { useToast } from '@/components/Toast';

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  gender: string | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: string | null;
  plan: string | null;
  storeId: string | null;
  registrationCompletedAt: string | null;
};

type StoreItem = { pageId: string; storeId: string; name: string };

const STATUS_OPTIONS = ['進行中', '休止中', '卒業'];

// バッジ色は app/admin/page.tsx の StatusBadge と同期させること
const STATUS_BADGE_CLASSES: Record<string, string> = {
  進行中: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  休止中: 'bg-amber-100 text-amber-800 border-amber-300',
  卒業: 'bg-sky-100 text-sky-700 border-sky-300',
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  進行中: '通常運用中。記録・レポート対象',
  休止中: '一時停止中',
  卒業: 'サービス終了',
};
const GENDER_OPTIONS = ['男性', '女性'];

const ACTIVITY_DISPLAY: Record<string, string> = {
  'ほぼ運動なし': 'ほぼ運動なし（デスクワーク中心）',
  '軽い': '軽い運動（週1-2回）',
  '中等度': '中程度の運動（週3-4回）',
  '激しい': '激しい運動（毎日）',
};

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const base = useAdminBase();
  const isStore = base === '/store';
  const ac = adminAccent(isStore);
  const router = useRouter();
  const pathname = usePathname() || '';
  const isFromProgress = pathname.includes('/progress/');
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [resettingOnboard, setResettingOnboard] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [goalKcal, setGoalKcal] = useState('');
  const [goalP, setGoalP] = useState('');
  const [goalF, setGoalF] = useState('');
  const [goalC, setGoalC] = useState('');
  // PFC ％（grams / kcal から導出して表示する編集可能フィールド）
  const [pctP, setPctP] = useState('');
  const [pctF, setPctF] = useState('');
  const [pctC, setPctC] = useState('');
  const pctFocus = useRef<null | 'P' | 'F' | 'C'>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [foodStatus, setFoodStatus] = useState('');

  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [currentWeightEdit, setCurrentWeightEdit] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [plan, setPlan] = useState('');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<StoreItem[]>([]);

  const today = jstToday();

  useEffect(() => {
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          setError(j?.error ? `店舗取得エラー: ${j.error}` : `店舗取得失敗（${r.status}）`);
          return;
        }
        setStores(j?.stores || []);
      })
      .catch((e) => setError(`店舗取得エラー: ${e.message}`));
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const c: Customer = j.customer;
        setCustomer(c);
        setName(c.name);
        setGoalKcal(String(c.goals.kcal));
        setGoalP(String(Math.round(c.goals.P)));
        setGoalF(String(Math.round(c.goals.F)));
        setGoalC(String(Math.round(c.goals.C)));
        setTargetWeight(c.targetWeight !== null ? String(c.targetWeight) : '');
        setTargetDate(c.targetDate || '');
        setFoodStatus(c.foodStatus || '');
        setGender(c.gender || '');
        setHeightCm(c.heightCm !== null ? String(c.heightCm) : '');
        setAge(c.age !== null ? String(c.age) : '');
        setCurrentWeightEdit(c.currentWeight !== null ? String(c.currentWeight) : '');
        setActivityLevel(c.activityLevel || '');
        setPlan(c.plan || '');
        setStoreId(c.storeId || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const remainingDays = useMemo(() => {
    if (!targetDate) return null;
    return daysUntil(targetDate, today);
  }, [targetDate, today]);

  const calc = useMemo(() => {
    return calcGoals({
      gender: gender || null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      age: age ? parseInt(age, 10) : null,
      activityLevel: activityLevel || null,
      plan: plan || null,
      currentWeight: currentWeightEdit ? parseFloat(currentWeightEdit) : null,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      targetDate: targetDate || null,
      today,
    });
  }, [gender, heightCm, age, activityLevel, plan, currentWeightEdit, targetWeight, targetDate, today]);

  useEffect(() => {
    if (!calc) return;
    setGoalKcal(String(calc.goalKcal));
    setGoalP(String(Math.round(calc.goalP)));
    setGoalF(String(Math.round(calc.goalF)));
    setGoalC(String(Math.round(calc.goalC)));
  }, [calc]);

  // ───────── 目標カロリー / PFC(g) / ％ 連動 ─────────
  // 正本 = goalKcal + grams(goalP/F/C, 整数)。各マクロの g と ％ は kcal を介して連動。
  // ・目標カロリー編集 → 各マクロの％を保ったまま grams を再計算（全マクロ更新）
  // ・PFC(g) 編集      → そのマクロの％のみ更新（他マクロは不変・自動調整しない）
  // ・％編集           → そのマクロの grams のみ更新（他マクロは不変・自動調整しない）
  // 合計が目標カロリー(=100%)とズレても自動補正せず、下に案内（超過/未達）を表示する。
  const FACTOR: Record<'P' | 'F' | 'C', number> = { P: 4, F: 9, C: 4 };

  // grams / kcal の変化に追従して ％表示を再計算（編集中のフィールドは上書きしない）
  useEffect(() => {
    const k = parseFloat(goalKcal);
    const toPct = (g: number, factor: number) =>
      !k || k <= 0 ? '' : String(Math.round(((g * factor) / k) * 100));
    if (pctFocus.current !== 'P') setPctP(toPct(parseFloat(goalP) || 0, 4));
    if (pctFocus.current !== 'F') setPctF(toPct(parseFloat(goalF) || 0, 9));
    if (pctFocus.current !== 'C') setPctC(toPct(parseFloat(goalC) || 0, 4));
  }, [goalKcal, goalP, goalF, goalC]);

  // 目標カロリー編集: 各マクロの現在％を保ったまま grams（整数）を再計算（P/F/C すべて）
  function handleKcalChange(v: string) {
    setGoalKcal(v);
    const nk = parseFloat(v);
    if (!isFinite(nk) || nk <= 0) return;
    const toGram = (pctStr: string, factor: number): string | null => {
      const pct = parseFloat(pctStr);
      if (!isFinite(pct)) return null;
      return String(Math.round((nk * pct) / 100 / factor));
    };
    const gp = toGram(pctP, 4); if (gp !== null) setGoalP(gp);
    const gf = toGram(pctF, 9); if (gf !== null) setGoalF(gf);
    const gc = toGram(pctC, 4); if (gc !== null) setGoalC(gc);
  }

  // PFC(g) 編集: そのマクロのみ更新（kcal・他マクロは不変。％は effect が再導出）
  function handleGramChange(which: 'P' | 'F' | 'C', v: string) {
    if (which === 'P') setGoalP(v);
    else if (which === 'F') setGoalF(v);
    else setGoalC(v);
  }

  // ％編集: そのマクロの grams のみ更新（kcal・他マクロは不変・自動調整しない）
  function handlePctChange(which: 'P' | 'F' | 'C', v: string) {
    if (which === 'P') setPctP(v);
    else if (which === 'F') setPctF(v);
    else setPctC(v);
    const k = parseFloat(goalKcal);
    const pct = parseFloat(v);
    if (!isFinite(k) || k <= 0 || !isFinite(pct)) return; // 空・不正値では grams を触らない
    const gram = String(Math.round((k * pct) / 100 / FACTOR[which]));
    if (which === 'P') setGoalP(gram);
    else if (which === 'F') setGoalF(gram);
    else setGoalC(gram);
  }

  // ％編集終了: グラム由来の丸め済み％へ整える
  function handlePctBlur(which: 'P' | 'F' | 'C') {
    pctFocus.current = null;
    const k = parseFloat(goalKcal);
    if (!isFinite(k) || k <= 0) return;
    const g = parseFloat(which === 'P' ? goalP : which === 'F' ? goalF : goalC) || 0;
    const val = String(Math.round(((g * FACTOR[which]) / k) * 100));
    if (which === 'P') setPctP(val);
    else if (which === 'F') setPctF(val);
    else setPctC(val);
  }

  // PFC 合計（目標カロリーに対する％）。100 とのズレを案内に使う
  const macroTotal = useMemo(() => {
    const k = parseFloat(goalKcal);
    if (!isFinite(k) || k <= 0) return null;
    const sumKcal =
      (parseFloat(goalP) || 0) * 4 + (parseFloat(goalF) || 0) * 9 + (parseFloat(goalC) || 0) * 4;
    return { pct: Math.round((sumKcal / k) * 100), diffKcal: Math.round(sumKcal - k) };
  }, [goalKcal, goalP, goalF, goalC]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim() || undefined,
        goals: {
          kcal: parseInt(goalKcal, 10) || 0,
          P: parseFloat(goalP) || 0,
          F: parseFloat(goalF) || 0,
          C: parseFloat(goalC) || 0,
        },
        targetWeight: targetWeight ? parseFloat(targetWeight) : null,
        targetDate: targetDate || null,
        foodStatus: foodStatus || null,
        gender: gender || null,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        age: age ? parseInt(age, 10) : null,
        currentWeight: currentWeightEdit ? parseFloat(currentWeightEdit) : null,
        activityLevel: activityLevel || null,
        plan: plan || null,
        storeId: storeId || null,
      };
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      const j = await res.json();
      setCustomer(j.customer);
      toast.success('保存しました');
      router.push(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    const customerName = customer?.name || 'この顧客';
    if (!confirm(`「${customerName}」のアカウントを削除します。\n\n・LIFF からアクセスできなくなります\n・利用可能アカウント数のカウントから外れます\n・データ（食事記録など）は Notion に残ります\n\n本当に削除しますか？`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `削除失敗（${res.status}）`);
      }
      toast.success('削除しました');
      router.push(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除失敗');
      toast.error(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleting(false);
    }
  }

  async function resetOnboarding() {
    if (!confirm('ホーム＋食事記録ツアーをリセットします。\n顧客は次回 LIFF を開いたときに、再度ツアーが表示されます。')) {
      return;
    }
    setResettingOnboard(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/onboarding`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`リセット失敗（${res.status}）`);
      toast.success('リセット完了。顧客側で次回起動時から再表示されます');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リセット失敗');
      toast.error(e instanceof Error ? e.message : 'リセットに失敗しました');
    } finally {
      setResettingOnboard(false);
    }
  }

  const backHref = isFromProgress ? `${base}/progress` : base;

  return (
    <AdminShell title={customer?.name || '顧客詳細'} back={{ href: backHref }}>
      {loading ? (
        <div className="text-center text-stone-500 py-10">読み込み中…</div>
      ) : !customer ? (
        <div className="text-center text-stone-500 py-10">{error || '顧客が見つかりません'}</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
          )}

          {/* 基本情報 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
              基本情報
            </h2>
            <div className="mb-2">
              <label className="text-xs font-bold text-stone-700 mb-1 block">氏名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <Field label="LINEユーザーID" value={customer.lineUserId || '未設定'} />
            <Field
              label="登録完了日時"
              value={
                customer.registrationCompletedAt
                  ? new Date(customer.registrationCompletedAt).toLocaleString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-bold text-stone-700">ステータス</label>
                  <StatusInfoPopover />
                </div>
                <select
                  value={foodStatus}
                  onChange={(e) => setFoodStatus(e.target.value)}
                  className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                所属店舗
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">店舗未設定</option>
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>{s.name}</option>
                ))}
                {storeId && !stores.some((s) => s.storeId === storeId) && (
                  <option value={storeId}>{storeId}（旧値）</option>
                )}
              </select>
            </div>
          </section>

          {/* 身体情報 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              身体情報
            </h2>
            {/* 1段目: 性別 / 年齢 / 身長 / 開始体重 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <NumberInput label="年齢" value={age} onChange={setAge} step="1" suffix="歳" />
              <NumberInput label="身長" value={heightCm} onChange={setHeightCm} step="0.1" suffix="cm" />
              <NumberInput label="開始体重" value={currentWeightEdit} onChange={setCurrentWeightEdit} step="0.1" suffix="kg" />
            </div>
            {/* 2段目: 活動レベル / 希望のプラン */}
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
                  {ACTIVITY_LEVELS.map((a) => (
                    <option key={a.label} value={a.label}>
                      {ACTIVITY_DISPLAY[a.label] ?? a.label}
                    </option>
                  ))}
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
            <div className="mt-3 text-xs text-stone-500 leading-snug">
              ※ 性別・年齢・身長・開始体重・活動レベル・希望のプランを入力すると、目標カロリーとPFCが自動計算されます（手動編集可）。
            </div>
          </section>

          {/* 目標 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              目標
            </h2>

            {/* 目標体重・目標達成日 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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

            {/* 残日数バナー */}
            {targetDate && remainingDays !== null && (
              <div className="mb-3 rounded-xl border bg-sky-50 border-sky-200 text-sky-800 p-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                  <span className="text-xs font-bold whitespace-nowrap">
                    {remainingDays < 0 ? `目標日を ${Math.abs(remainingDays)} 日超過` :
                     remainingDays === 0 ? '目標日は今日' :
                     `目標まであと ${remainingDays} 日`}
                  </span>
                  {currentWeightEdit && targetWeight && (() => {
                    const cw = parseFloat(currentWeightEdit);
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
                  {(!currentWeightEdit || !targetWeight) && (
                    <span className="text-[11px] opacity-70">目標体重を入力すると1日あたり kcal が計算されます</span>
                  )}
                </div>
              </div>
            )}

            {/* 目標カロリー・PFC グリッド（2列×4行） */}
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-2">
                {/* 行1: 現在の消費カロリー / 目標カロリー */}
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
                      onChange={(e) => handleKcalChange(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">kcal</span>
                  </div>
                </div>

                {/* 行2: 目標タンパク質(g) / 目標タンパク質(%) */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質（g）</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      value={goalP}
                      onChange={(e) => handleGramChange('P', e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">g</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質（％）</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      value={pctP}
                      onFocus={() => { pctFocus.current = 'P'; }}
                      onChange={(e) => handlePctChange('P', e.target.value)}
                      onBlur={() => handlePctBlur('P')}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">%</span>
                  </div>
                </div>

                {/* 行3: 目標脂質(g) / 目標脂質(%) */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質（g）</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      value={goalF}
                      onChange={(e) => handleGramChange('F', e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">g</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質（％）</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      value={pctF}
                      onFocus={() => { pctFocus.current = 'F'; }}
                      onChange={(e) => handlePctChange('F', e.target.value)}
                      onBlur={() => handlePctBlur('F')}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">%</span>
                  </div>
                </div>

                {/* 行4: 目標炭水化物(g) / 目標炭水化物(%) */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物（g）</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      value={goalC}
                      onChange={(e) => handleGramChange('C', e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">g</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物（％）</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      value={pctC}
                      onFocus={() => { pctFocus.current = 'C'; }}
                      onChange={(e) => handlePctChange('C', e.target.value)}
                      onBlur={() => handlePctBlur('C')}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 pr-12 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">%</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {macroTotal && macroTotal.pct > 100 && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 leading-snug">
                    ⚠️ PFC合計が <b>{macroTotal.pct}%</b> で目標カロリーを<b>超過</b>しています（+{macroTotal.diffKcal} kcal）。各値を調整してください。
                  </div>
                )}
                {macroTotal && macroTotal.pct < 100 && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
                    ⚠️ PFC合計が <b>{macroTotal.pct}%</b> で目標カロリーに<b>達していません</b>（残り {100 - macroTotal.pct}% / {Math.abs(macroTotal.diffKcal)} kcal）。
                  </div>
                )}
                {macroTotal && macroTotal.pct === 100 && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 leading-snug">
                    ✓ PFC合計 100%（目標カロリーと一致）
                  </div>
                )}
                <p className="text-[11px] text-stone-500 leading-snug">
                  ※ 目標カロリーを変えると PFC(g) が比率を保って再計算されます。PFC(g)・％ は各項目を個別に編集でき、他の値は自動調整されません（合計が100%とズレると上に案内）。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={`w-full ${ac.btn} text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              <Save className="w-4 h-4" strokeWidth={2.2} />
              {saving ? '保存中…' : '変更を保存'}
            </button>
          </section>

          {/* ツアーリセット（運営/admin のみ。店舗側には非表示） */}
          {!isStore && (
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
              <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
                ツアーリセット
              </h3>
              <p className="text-[11px] text-stone-600 mb-3 leading-relaxed">
                ホーム初回ガイド・食事記録ガイドを再表示します。顧客が次回 LIFF を開いたときから再表示されます。
                目標値・体重・性別などの基本情報は保持されます。
              </p>
              <button
                type="button"
                onClick={resetOnboarding}
                disabled={resettingOnboard}
                className="w-full bg-white border border-stone-300 text-stone-700 font-bold py-2.5 rounded-xl text-sm active:bg-stone-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.2} />
                {resettingOnboard ? 'リセット中…' : 'ホーム＋食事記録ツアーを再表示'}
              </button>
            </section>
          )}

          {/* アカウント削除（危険操作） */}
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className="w-full bg-rose-600 text-white font-bold py-2.5 rounded-xl text-sm active:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {deleting ? '削除中…' : 'アカウントを削除する'}
          </button>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem,1fr] gap-2 py-1 text-sm">
      <div className="text-stone-600">{label}</div>
      <div className="text-stone-900 break-all">{value}</div>
    </div>
  );
}

function NumberInput({
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
      {label && (
        <label className="text-xs font-bold text-stone-700 mb-1 block">
          {label}
        </label>
      )}
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

function StatusInfoPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        aria-label="ステータスの説明を表示"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-5 h-5 rounded-full text-stone-400 hover:text-stone-600 active:text-stone-800 focus:outline-none"
      >
        <Info className="w-3.5 h-3.5" strokeWidth={2.2} />
      </button>
      {open && (
        <div role="dialog" aria-label="ステータスの意味" className="absolute left-0 top-6 z-50 w-72 bg-white border border-stone-200 rounded-xl shadow-lg p-3">
          <p className="text-[10px] font-bold text-stone-500 mb-2 uppercase tracking-wide">ステータスの意味</p>
          <ul className="space-y-2">
            {STATUS_OPTIONS.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE_CLASSES[s] ?? 'bg-stone-100 text-stone-700 border-stone-300'}`}>
                  <Circle className="w-2 h-2 fill-current" strokeWidth={0} />
                  {s}
                </span>
                <span className="flex-1 text-xs text-stone-600 leading-relaxed">{STATUS_DESCRIPTIONS[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
