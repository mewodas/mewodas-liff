'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Target,
  Scale,
  ClipboardList,
  Save,
  Calendar as CalendarIcon,
  Calculator,
  Hourglass,
  History,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Dumbbell,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import AdminShell from '../../AdminShell';
import { ACTIVITY_LEVELS, calcGoals, daysUntil } from '@/lib/goalCalc';
import { useAdminBase } from '@/lib/useAdminBase';

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
};

type StoreItem = { pageId: string; storeId: string; name: string };
type Notification = {
  id: string;
  category: string;
  title: string;
  body: string;
  staffName: string;
  read: boolean;
  createdAt: string;
};

const STATUS_OPTIONS = ['設定中', '進行中', '休止中', '卒業'];
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
  const router = useRouter();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  type WeightEntry = { date: string; weight: number | null; exercised: boolean; exerciseContent: string };
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [weightTargetWeight, setWeightTargetWeight] = useState<number | null>(null);
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightWarning, setWeightWarning] = useState<string | null>(null);
  const [weightDays, setWeightDays] = useState(30);
  const [weightOpen, setWeightOpen] = useState(false);

  type ExerciseLog = {
    id: string;
    date: string;
    exercise: string;
    category: string;
    durationMin: number;
    intensity: string;
    estimatedKcal: number;
    memo: string;
  };
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseDays, setExerciseDays] = useState(30);
  const [exerciseOpen, setExerciseOpen] = useState(false);

  const today = jstToday();

  useEffect(() => {
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setStores(j?.stores || []))
      .catch(() => {});
    fetch(`/api/admin/customers/${id}/notifications`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setNotifications(j?.notifications || []))
      .catch(() => {});
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
        setGoalP(String(c.goals.P));
        setGoalF(String(c.goals.F));
        setGoalC(String(c.goals.C));
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

  const fRatio = useMemo(() => {
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
      router.push(`${base}?saved=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  async function resetOnboarding() {
    if (!confirm('この顧客のオンボーディング完了状態をリセットします。\n顧客は次回 LIFF を開いたときに、再度オンボーディング画面が表示されます。\n本当にリセットしますか？')) {
      return;
    }
    setResettingOnboard(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/onboarding`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`リセット失敗（${res.status}）`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リセット失敗');
    } finally {
      setResettingOnboard(false);
    }
  }

  async function loadWeightHistory(days: number) {
    setWeightLoading(true);
    setWeightWarning(null);
    try {
      const res = await fetch(`/api/admin/customers/${id}/weight-history?days=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setWeightHistory(j.weights || []);
      setWeightTargetWeight(j.targetWeight ?? null);
      if (j.warning) setWeightWarning(j.warning);
    } catch (e) {
      setWeightWarning(e instanceof Error ? e.message : 'エラー');
    } finally {
      setWeightLoading(false);
    }
  }

  async function loadExerciseLogs(days: number) {
    setExerciseLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/exercise-logs?days=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setExerciseLogs(j.logs || []);
    } catch {
      setExerciseLogs([]);
    } finally {
      setExerciseLoading(false);
    }
  }

  return (
    <AdminShell title={customer?.name || '顧客詳細'} back={{ href: base }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">
                  ステータス
                </label>
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
                <option value="">—</option>
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>{s.name}</option>
                ))}
              </select>
            </div>
          </section>

          {/* 身体情報 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              身体情報
            </h2>
            {/* 1段目: 性別 / 年齢 / 身長 / 現在体重 */}
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
              <NumberInput label="年齢" value={age} onChange={setAge} step="1" />
              <NumberInput label="身長 (cm)" value={heightCm} onChange={setHeightCm} step="0.1" />
              <NumberInput label="現在体重 (kg)" value={currentWeightEdit} onChange={setCurrentWeightEdit} step="0.1" />
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
              ※ 性別・年齢・身長・現在体重・活動レベル・希望のプランを入力すると、目標カロリーとPFCが自動計算されます（手動編集可）。
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
                  目標体重 (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
              <div className="mb-3 rounded-xl border bg-sky-50 border-sky-200 text-sky-800 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                  <span className="text-sm font-bold">
                    {remainingDays < 0 ? `目標日を ${Math.abs(remainingDays)} 日超過` :
                     remainingDays === 0 ? '目標日は今日' :
                     `目標まであと ${remainingDays} 日`}
                  </span>
                </div>
                {currentWeightEdit && targetWeight ? (() => {
                  const cw = parseFloat(currentWeightEdit);
                  const tw = parseFloat(targetWeight);
                  if (isNaN(cw) || isNaN(tw)) return null;
                  const diff = tw - cw;
                  const weightLabel = diff < 0
                    ? `あと ${Math.abs(diff).toFixed(1)}kg 減量`
                    : diff > 0
                    ? `あと ${diff.toFixed(1)}kg 増量`
                    : '現体重キープ';
                  const delta = calc?.clampedDelta;
                  const rawDelta = calc?.dailyDeltaKcal;
                  const isClamped =
                    rawDelta !== undefined &&
                    delta !== undefined &&
                    Math.abs(rawDelta - delta) > 1;
                  const absDiff = Math.abs(diff);
                  return (
                    <div className="space-y-0.5 pl-6">
                      <div className="text-xs font-bold">
                        {weightLabel}
                        {delta !== undefined && delta !== 0 && (
                          <span className="ml-2">
                            {delta < 0 ? `／ 1日あたり ${delta} kcal 削減` : `／ 1日あたり +${delta} kcal 追加`}
                          </span>
                        )}
                      </div>
                      {delta !== undefined && Math.abs(delta) > 0 && remainingDays !== null && remainingDays > 0 && diff !== 0 && (
                        <div className="text-[10px] opacity-70">
                          ({absDiff.toFixed(1)}kg × 7,700 ÷ {remainingDays}日 = {Math.round(rawDelta ?? 0)} kcal/日)
                        </div>
                      )}
                      {isClamped && (
                        <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 leading-snug">
                          ⚠️ 計算上 {Math.round(rawDelta ?? 0)} kcal/日 必要ですが、健康上の安全上限（1日 ±1,000 kcal）でクランプしています。<br />
                          → 目標達成日を後ろにずらすか、目標体重を見直してください。このままでは目標日に体重が到達しません。
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="pl-6 text-[11px] opacity-70">目標体重を入力すると1日あたり kcal が計算されます</div>
                )}
              </div>
            )}

            {/* 目標カロリー・PFC グリッド（2列×4行） */}
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-2">
                {/* 行1: 現在の消費カロリー / 目標カロリー */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">現在の消費カロリー (kcal)</label>
                  <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center font-bold text-stone-700">
                    {calc?.tdee ?? '—'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標カロリー (kcal)</label>
                  <input
                    type="number"
                    step="1"
                    inputMode="decimal"
                    value={goalKcal}
                    onChange={(e) => setGoalKcal(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 行2: 目標タンパク質(g) / 目標タンパク質(%) */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質 (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalP}
                    onChange={(e) => setGoalP(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質 (%)</label>
                  <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center font-bold text-stone-700">
                    {pRatio !== null ? `${pRatio}%` : '—'}
                  </div>
                </div>

                {/* 行3: 目標脂質(g) / 目標脂質(%) */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質 (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalF}
                    onChange={(e) => setGoalF(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質 (%)</label>
                  <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center font-bold text-stone-700">
                    {fRatio !== null ? `${fRatio}%` : '—'}
                  </div>
                </div>

                {/* 行4: 目標炭水化物(g) / 目標炭水化物(%) */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物 (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalC}
                    onChange={(e) => setGoalC(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物 (%)</label>
                  <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center font-bold text-stone-700">
                    {cRatio !== null ? `${cRatio}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" strokeWidth={2.2} />
              {saving ? '保存中…' : '変更を保存'}
            </button>
          </section>

          {/* 体重推移グラフ + 運動記録 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
            <button
              type="button"
              onClick={() => {
                const next = !weightOpen;
                setWeightOpen(next);
                if (next && weightHistory.length === 0) {
                  loadWeightHistory(weightDays);
                }
              }}
              className="w-full flex items-center justify-between p-3 active:bg-stone-50"
            >
              <span className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
                体重推移 / 運動記録
              </span>
              {weightOpen ? (
                <ChevronUp className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
              )}
            </button>
            {weightOpen && (
              <div className="px-3 pb-3 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {[14, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setWeightDays(d);
                        setWeightHistory([]);
                        loadWeightHistory(d);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-bold border transition-colors ${
                        weightDays === d
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {d}日
                    </button>
                  ))}
                  {weightLoading && <span className="text-xs text-stone-500 py-1">読み込み中…</span>}
                </div>

                {weightWarning && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{weightWarning}</div>
                )}

                {weightHistory.some((w) => w.weight !== null) ? (
                  <div>
                    <div className="text-xs font-bold text-stone-700 mb-1 inline-flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.2} />
                      体重推移
                    </div>
                    <WeightLineChart entries={weightHistory} targetWeight={weightTargetWeight} />

                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-stone-500 border-b border-stone-100">
                            <th className="text-left py-1 pr-3 font-bold">日付</th>
                            <th className="text-right py-1 pr-3 font-bold">体重 (kg)</th>
                            <th className="text-right py-1 font-bold">前日差</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weightHistory
                            .filter((w) => w.weight !== null)
                            .slice()
                            .reverse()
                            .slice(0, 20)
                            .map((w, idx, arr) => {
                              const prev = arr[idx + 1];
                              const diff =
                                prev?.weight !== null && prev?.weight !== undefined && w.weight !== null
                                  ? Math.round((w.weight - prev.weight) * 10) / 10
                                  : null;
                              const [, m, d] = w.date.split('-').map(Number);
                              return (
                                <tr key={w.date} className="border-b border-stone-50">
                                  <td className="py-1 pr-3 text-stone-700">{m}/{d}</td>
                                  <td className="py-1 pr-3 text-right font-bold text-stone-900">{w.weight}</td>
                                  <td className={`py-1 text-right font-bold ${
                                    diff === null ? 'text-stone-400' :
                                    diff < 0 ? 'text-sky-600' :
                                    diff > 0 ? 'text-rose-500' : 'text-stone-600'
                                  }`}>
                                    {diff === null ? '—' : diff > 0 ? `+${diff}` : String(diff)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : !weightLoading ? (
                  <div className="text-xs text-stone-500 py-2">この期間に体重記録がありません</div>
                ) : null}

                {weightHistory.some((w) => w.exercised || w.exerciseContent) && (
                  <div>
                    <div className="text-xs font-bold text-stone-700 mb-1 inline-flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5 text-violet-600" strokeWidth={2.2} />
                      運動記録
                    </div>
                    <div className="space-y-1">
                      {weightHistory
                        .filter((w) => w.exercised || w.exerciseContent)
                        .slice()
                        .reverse()
                        .slice(0, 15)
                        .map((w) => {
                          const [, m, d] = w.date.split('-').map(Number);
                          return (
                            <div key={w.date} className="flex gap-2 text-xs py-1 border-b border-stone-50">
                              <span className="text-stone-500 flex-shrink-0 w-10">{m}/{d}</span>
                              <span className="text-emerald-700 font-bold flex-shrink-0">✅</span>
                              <span className="text-stone-800 break-all">{w.exerciseContent || '運動あり'}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 運動記録（新DB） */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
            <button
              type="button"
              onClick={() => {
                const next = !exerciseOpen;
                setExerciseOpen(next);
                if (next && exerciseLogs.length === 0) {
                  loadExerciseLogs(exerciseDays);
                }
              }}
              className="w-full flex items-center justify-between p-3 active:bg-stone-50"
            >
              <span className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <Dumbbell className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
                運動記録
              </span>
              {exerciseOpen ? (
                <ChevronUp className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
              )}
            </button>
            {exerciseOpen && (
              <div className="px-3 pb-3 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {[14, 30, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setExerciseDays(d);
                        setExerciseLogs([]);
                        loadExerciseLogs(d);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-bold border transition-colors ${
                        exerciseDays === d
                          ? 'bg-violet-500 text-white border-violet-500'
                          : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {d}日
                    </button>
                  ))}
                  {exerciseLoading && <span className="text-xs text-stone-500 py-1">読み込み中…</span>}
                </div>

                {exerciseLogs.length === 0 && !exerciseLoading && (
                  <div className="text-xs text-stone-500 py-2">この期間に運動記録がありません</div>
                )}

                {exerciseLogs.length > 0 && (
                  <>
                    <ExerciseBarChart logs={exerciseLogs} days={exerciseDays} />

                    <div className="flex gap-3 text-xs">
                      <div className="bg-violet-50 rounded-lg px-3 py-1.5 text-center">
                        <div className="font-bold text-violet-700">{exerciseLogs.length}回</div>
                        <div className="text-stone-500">運動</div>
                      </div>
                      <div className="bg-sky-50 rounded-lg px-3 py-1.5 text-center">
                        <div className="font-bold text-sky-700">{exerciseLogs.reduce((a, l) => a + l.durationMin, 0)}分</div>
                        <div className="text-stone-500">合計時間</div>
                      </div>
                      <div className="bg-amber-50 rounded-lg px-3 py-1.5 text-center">
                        <div className="font-bold text-amber-600">{exerciseLogs.reduce((a, l) => a + l.estimatedKcal, 0)} kcal</div>
                        <div className="text-stone-500">消費</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-stone-500 border-b border-stone-100">
                            <th className="text-left py-1 pr-2 font-bold">日付</th>
                            <th className="text-left py-1 pr-2 font-bold">種目</th>
                            <th className="text-right py-1 pr-2 font-bold">時間</th>
                            <th className="text-right py-1 pr-2 font-bold">kcal</th>
                            <th className="text-left py-1 font-bold">強度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exerciseLogs.slice(0, 20).map((log) => {
                            const [, m, d] = log.date.split('-').map(Number);
                            return (
                              <tr key={log.id} className="border-b border-stone-50">
                                <td className="py-1 pr-2 text-stone-600">{m}/{d}</td>
                                <td className="py-1 pr-2 text-stone-900 font-bold">{log.exercise}</td>
                                <td className="py-1 pr-2 text-right text-stone-700">{log.durationMin}分</td>
                                <td className="py-1 pr-2 text-right font-bold text-amber-600">{log.estimatedKcal}</td>
                                <td className={`py-1 text-[10px] font-bold ${
                                  log.intensity === '激しい' ? 'text-rose-600' :
                                  log.intensity === '中等度' ? 'text-amber-600' : 'text-emerald-600'
                                }`}>{log.intensity}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* 送信履歴 */}
          {notifications.length > 0 && (
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="w-full flex items-center justify-between p-3 active:bg-stone-50"
              >
                <span className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                  <History className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
                  送信履歴（{notifications.length}件）
                </span>
                {notifOpen ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
                )}
              </button>
              {notifOpen && (
                <ul className="divide-y divide-stone-100">
                  {notifications.slice(0, 20).map((n) => {
                    const date = new Date(n.createdAt).toLocaleString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <li key={n.id} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {n.category}
                          </span>
                          <span className="text-[11px] text-stone-500 flex-shrink-0">{date}</span>
                          {n.read && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0">既読</span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-stone-900 mt-1 truncate">{n.title}</div>
                        <div className="text-[11px] text-stone-600 mt-0.5 line-clamp-2">{n.body}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {isAdminRoute && (
            <section className="bg-white rounded-2xl border-2 border-red-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600" strokeWidth={2.2} />
                <h3 className="text-sm font-bold text-red-700">危険な操作（管理者専用）</h3>
              </div>
              <p className="text-[11px] text-stone-600 mb-3 leading-relaxed">
                オンボーディングをリセットすると、顧客が次回 LIFF を開いたときに再度オンボーディング画面が表示されます。
                顧客の入力した目標値・体重・性別などの基本情報は保持されます。
              </p>
              <button
                type="button"
                onClick={resetOnboarding}
                disabled={resettingOnboard}
                className="w-full bg-white border-2 border-red-500 text-red-600 font-bold py-2.5 rounded-xl text-sm active:bg-red-50 disabled:opacity-50"
              >
                {resettingOnboard ? 'リセット中…' : '🔄 オンボーディングをリセット'}
              </button>
            </section>
          )}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      {label && (
        <label className="text-xs font-bold text-stone-700 mb-1 block">
          {label}
        </label>
      )}
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

function WeightLineChart({
  entries,
  targetWeight,
}: {
  entries: Array<{ date: string; weight: number | null }>;
  targetWeight: number | null;
}) {
  const data = entries.map((e) => {
    const [, m, d] = e.date.split('-').map(Number);
    return { label: `${m}/${d}`, weight: e.weight };
  });

  const weights = entries.map((e) => e.weight).filter((w): w is number => w !== null);
  const minW = weights.length > 0 ? Math.floor(Math.min(...weights, targetWeight ?? Infinity) - 1) : undefined;
  const maxW = weights.length > 0 ? Math.ceil(Math.max(...weights, targetWeight ?? -Infinity) + 1) : undefined;

  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            tick={{ fontSize: 10, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
            domain={[minW ?? 'auto', maxW ?? 'auto']}
            tickFormatter={(v) => `${v}kg`}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
            formatter={(v) => [`${v} kg`, '体重']}
          />
          {targetWeight !== null && (
            <ReferenceLine
              y={targetWeight}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{ value: `目標 ${targetWeight}kg`, fontSize: 9, fill: '#10b981', position: 'insideTopRight' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExerciseBarChart({
  logs,
  days,
}: {
  logs: Array<{ date: string; durationMin: number; estimatedKcal: number }>;
  days: number;
}) {
  const byDate: Record<string, number> = {};
  for (const log of logs) {
    byDate[log.date] = (byDate[log.date] || 0) + log.durationMin;
  }
  const data = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-Math.min(days, 30))
    .map(([date, min]) => {
      const [, m, d] = date.split('-').map(Number);
      return { label: `${m}/${d}`, min };
    });

  if (data.length === 0) return null;

  return (
    <div className="w-full h-32">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            tick={{ fontSize: 9, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}分`}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
            formatter={(v) => [`${v}分`, '運動時間']}
          />
          <Bar dataKey="min" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
