'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  RefreshCw,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Activity,
  FileText,
  Send,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
  Target as TargetIcon,
  CalendarCheck,
  Hourglass,
  Scale,
  Dumbbell,
  UtensilsCrossed,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { daysUntil } from '@/lib/goalCalc';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import AdminShell from '../AdminShell';
import { adminAccent } from '@/lib/adminAccent';
import DateRangePicker from '../DateRangePicker';
import { useAdminBase } from '@/lib/useAdminBase';
import { toDriveThumbnailUrl } from '@/lib/imageUrl';

type Customer = { pageId: string; name: string; foodStatus: string | null; storeId: string | null; lineUserId?: string };

type Analysis = {
  summary: string;
  strengths: string[];
  concerns: string[];
  patterns: string[];
  recommendations: string[];
  improvements: string[];
  foodAdvice: string[];
  actionPlan: string[];
  reportDraft: string;
};

type Stats = {
  totalDays: number;
  avg: { kcal: number; P: number; F: number; C: number };
  sum: { kcal: number; P: number; F: number; C: number };
};

type Daily = { date: string; kcal: number | null; P: number | null; F: number | null; C: number | null; count: number };
type Goals = { kcal: number; P: number; F: number; C: number };
type TargetInfo = { currentWeight: number | null; targetWeight: number | null; targetDate: string | null; startDate: string | null; startWeight: number | null };

type WeightLog = {
  id: string;
  date: string;
  weightKg: number;
  memo: string;
};

type BodyCompLog = {
  id: string;
  measureDate: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  bodyFatMassKg: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
  basalMetabolicKcal: number | null;
  visceralFatLevel: number | null;
  skeletalMuscleMassKg: number | null;
  rightArmMuscleKg: number | null;
  leftArmMuscleKg: number | null;
  rightLegMuscleKg: number | null;
  leftLegMuscleKg: number | null;
  trunkMuscleKg: number | null;
};

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

type MealRecord = {
  pageId: string;
  date: string;
  mealType: string;
  title: string;
  memo: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  recordedAt: string;
  imageUrl: string | null;
};

const ANALYSIS_MEAL_ICON: Record<string, LucideIcon> = {
  朝食: Sunrise,
  昼食: Sun,
  夕食: Moon,
  間食: Cookie,
};
const ANALYSIS_MEAL_COLOR: Record<string, string> = {
  朝食: 'text-orange-500',
  昼食: 'text-amber-500',
  夕食: 'text-indigo-500',
  間食: 'text-pink-500',
};

function extractFoodLine(m: { title: string; memo: string }): string {
  const memo = (m.memo || '').trim();
  if (memo) {
    const beforeAi = memo.split(/\s*\/\s*AI識別[:：]/)[0]?.trim();
    if (beforeAi) return beforeAi;
  }
  return m.title || '食事';
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function addDaysStr(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function diffDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}
function shortDate(s: string): string {
  const [, m, d] = s.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export default function AdminAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-stone-500">読み込み中…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const base = useAdminBase();
  const ac = adminAccent(base === '/store');
  const initialCustomerId = sp.get('customer') || sp.get('customerId') || '';
  const today = jstToday();
  const initialDate = (() => {
    const d = sp.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today) return d;
    return null;
  })();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<{ storeId: string; name: string }[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [from, setFrom] = useState<string>(initialDate ?? today);
  const [to, setTo] = useState<string>(initialDate ?? today);

  // グラフ用データ（data API）
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [mealTypeKcal, setMealTypeKcal] = useState<Record<string, number> | null>(null);
  const [mealTypeP, setMealTypeP] = useState<Record<string, number> | null>(null);
  const [mealTypeF, setMealTypeF] = useState<Record<string, number> | null>(null);
  const [mealTypeC, setMealTypeC] = useState<Record<string, number> | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [target, setTarget] = useState<TargetInfo | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [bodyCompLogs, setBodyCompLogs] = useState<BodyCompLog[]>([]);
  // 現在表示中の体組成データがどの顧客のものか（フェッチ完了の同一性判定用）。
  // これが customerId と一致するまでセクションを描画しない＝読み込み中の先行表示/前顧客データのちらつきを防ぐ。
  const [bodyCompFetchedId, setBodyCompFetchedId] = useState<string | null>(null);
  const [bodyCompOpen, setBodyCompOpen] = useState(false);
  // ユーザーが手動で開閉したら自動開閉を止める（顧客切替でリセット）。記録ありで自動展開・0件で畳む。
  const bodyCompUserToggledRef = useRef(false);

  // AI サマリ
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);

  // 食事一覧
  const [mealList, setMealList] = useState<MealRecord[] | null>(null);
  const [mealListLoading, setMealListLoading] = useState(false);
  const [mealListError, setMealListError] = useState<string | null>(null);

  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // データフェッチのデバウンス用 + 進行中リクエストの中断用
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (cid: string, f: string, t: string) => {
    // 先行リクエストが in-flight なら中断し、古いレスポンスでの上書きを防ぐ
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setDataLoading(true);
    setDataError(null);
    setAnalysis(null);
    setAiError(null);
    setAiMessage(null);
    setMealList(null);
    setMealListError(null);
    try {
      const res = await fetch(`/api/admin/customers/${cid}/analysis/data?from=${f}&to=${t}`, {
        cache: 'no-store',
        signal: ac.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `データ取得失敗（${res.status}）`);
      }
      const j = await res.json();
      setStats(j.stats);
      setDaily(j.daily || []);
      setMealTypeKcal(j.mealTypeKcal || null);
      setMealTypeP(j.mealTypeP || null);
      setMealTypeF(j.mealTypeF || null);
      setMealTypeC(j.mealTypeC || null);
      setGoals(j.goals || null);
      setTarget(j.target || null);
      setWeightLogs(j.weightLogs || []);
      setExerciseLogs(j.exerciseLogs || []);
      setRangeLabel(j.rangeLabel || '');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 中断は無視
      setDataError(e instanceof Error ? e.message : 'エラー');
    } finally {
      // 中断済みなら後続リクエストが loading を管理しているので触らない
      if (!ac.signal.aborted) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [res, sRes] = await Promise.all([
          fetch('/api/admin/customers', { cache: 'no-store' }),
          fetch('/api/admin/stores', { cache: 'no-store' }),
        ]);
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setCustomers((j.customers || []).filter((c: Customer) => !!c.foodStatus));
        const sJ = sRes.ok ? await sRes.json() : { stores: [] };
        setStores(sJ.stores || []);
      } catch (e) {
        setDataError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  // 店舗ID → 表示名（メヲダス五反田店 等）。未登録なら storeId をそのまま使う
  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) m.set(s.storeId, s.name);
    return m;
  }, [stores]);

  // 店舗一覧（ユニーク）
  const storeOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: '', label: 'すべての店舗' }];
    for (const c of customers) {
      const key = c.storeId ?? '';
      // 店舗未設定（空キー）はフィルタに出さない
      if (key === '' || seen.has(key)) continue;
      seen.add(key);
      opts.push({ value: key, label: storeNameById.get(key) || key });
    }
    return opts;
  }, [customers, storeNameById]);

  // 絞り込み済み顧客一覧
  const filteredCustomers = useMemo(() => {
    if (selectedStore === '') return customers;
    return customers.filter((c) => (c.storeId ?? '') === selectedStore);
  }, [customers, selectedStore]);

  const isSingleDay = from === to;
  const periodDays = useMemo(() => diffDays(from, to), [from, to]);

  function shiftRange(delta: number) {
    setFrom(addDaysStr(from, delta));
    setTo(addDaysStr(to, delta));
  }

  const clearData = useCallback(() => {
    setStats(null);
    setDaily([]);
    setMealTypeKcal(null);
    setMealTypeP(null);
    setMealTypeF(null);
    setMealTypeC(null);
    setGoals(null);
    setTarget(null);
    setWeightLogs([]);
    setExerciseLogs([]);
    setRangeLabel('');
    setAnalysis(null);
    setAiError(null);
    setAiMessage(null);
    setMealList(null);
    setMealListError(null);
    setBodyCompLogs([]);
  }, []);

  // 顧客または日付が変わったら data API を自動フェッチ（デバウンス 300ms）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!customerId) {
      debounceRef.current = setTimeout(clearData, 0);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    debounceRef.current = setTimeout(() => {
      fetchData(customerId, from, to);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [customerId, from, to, fetchData, clearData]);

  // 顧客が変わったら体組成データを取得（日付範囲は無関係：全履歴）
  useEffect(() => {
    if (!customerId) {
      setBodyCompLogs([]);
      setBodyCompFetchedId(null);
      return;
    }
    const customer = customers.find((c) => c.pageId === customerId);
    const lineUserId = customer?.lineUserId;
    if (!lineUserId) return;
    // 顧客切替時は前データを即クリアし、完了IDも一旦リセット（前顧客データの先行表示を防ぐ）。
    // 自動開閉も新顧客のデータ有無で再判定するためフラグをリセット。
    setBodyCompLogs([]);
    setBodyCompFetchedId(null);
    bodyCompUserToggledRef.current = false;
    const cid = customerId;
    let cancelled = false;
    fetch(`/api/admin/body-composition?lineUserId=${encodeURIComponent(lineUserId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const fetched: BodyCompLog[] = j?.logs || [];
        setBodyCompLogs(fetched);
        setBodyCompFetchedId(cid);
        // 記録があれば自動展開・0件なら畳む（ユーザーが手動操作していない場合のみ）
        if (!bodyCompUserToggledRef.current) setBodyCompOpen(fetched.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setBodyCompLogs([]);
        setBodyCompFetchedId(cid);
        if (!bodyCompUserToggledRef.current) setBodyCompOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, customers]);

  async function runAi() {
    if (!customerId) return;
    // 食事一覧と排他表示：後から押した方（AIサマリ）に切り替える
    setMealList(null);
    setMealListError(null);
    setAiLoading(true);
    setAiError(null);
    setAiMessage(null);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `分析失敗（${res.status}）`);
      }
      const j = await res.json();
      setAnalysis(j.analysis);
      if (j.message) setAiMessage(j.message);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setAiLoading(false);
    }
  }

  async function fetchMealList() {
    if (!customerId) return;
    // AIサマリと排他表示：後から押した方（食事一覧）に切り替える
    setAnalysis(null);
    setAiError(null);
    setAiMessage(null);
    setMealListLoading(true);
    setMealListError(null);
    try {
      const sp = new URLSearchParams({ customerId, from, to });
      const res = await fetch(`/api/admin/meals?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `取得失敗（${res.status}）`);
      }
      const j = await res.json();
      setMealList(j.meals || []);
    } catch (e) {
      setMealListError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setMealListLoading(false);
    }
  }

  const hasData = !!stats;

  return (
    <AdminShell title="顧客分析">
      <div className="space-y-3">
        {/* フィルタバー（進捗管理と同じ構成: 期間→店舗チップ→顧客select） */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <DateRangePicker
            from={from}
            to={to}
            today={today}
            onChangeFrom={setFrom}
            onChangeTo={setTo}
            onShift={shiftRange}
            isSingleDay={isSingleDay}
          />

          {/* 店舗チップ（読み込み前から「すべての店舗」を表示） */}
          <div className="flex gap-1 flex-wrap">
            {storeOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setSelectedStore(o.value);
                  const newFiltered = customers.filter((c) =>
                    o.value === '' ? true : (c.storeId ?? '') === o.value
                  );
                  if (customerId && !newFiltered.find((c) => c.pageId === customerId)) {
                    setCustomerId('');
                  }
                }}
                className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                  selectedStore === o.value
                    ? ac.pillActive
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* 顧客 select */}
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">顧客を選択してください</option>
            {filteredCustomers.map((c) => (
              <option key={c.pageId} value={c.pageId}>
                {c.name}
              </option>
            ))}
          </select>
          {loadingCustomers && <div className="text-[11px] text-stone-500">顧客読み込み中…</div>}
        </section>

        {/* データ読み込み中インジケータ */}
        {dataLoading && (
          <div className="flex items-center justify-center gap-2 py-2 text-stone-500 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
            データ取得中…
          </div>
        )}

        {dataError && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{dataError}</div>}

        {/* ---- 目標達成までの残日数 ---- */}
        {target?.targetDate && (() => {
          const rem = daysUntil(target.targetDate, today);
          const weightDiff =
            target.currentWeight !== null && target.targetWeight !== null
              ? Math.round((target.targetWeight - target.currentWeight) * 10) / 10
              : null;
          const tone =
            rem < 0 ? 'bg-rose-50 border-rose-200 text-rose-800'
            : rem === 0 ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-sky-50 border-sky-200 text-sky-800';
          return (
            <section className={`rounded-2xl border shadow-sm p-3 flex items-center gap-2 ${tone}`}>
              <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
              <div className="text-sm font-bold">
                {rem < 0 ? `目標日を ${Math.abs(rem)} 日超過`
                 : rem === 0 ? '目標日は今日'
                 : `目標まであと ${rem} 日`}
              </div>
              {weightDiff !== null && (
                <div className="ml-auto text-[11px] opacity-80">
                  体重差 {weightDiff > 0 ? '+' : ''}{weightDiff} kg
                </div>
              )}
            </section>
          );
        })()}

        {/* ---- ① 数値ハイライト ---- */}
        {hasData && stats && (
          <section className="bg-gradient-to-br from-emerald-50 to-sky-50 rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-3">
            <div className="text-[11px] font-bold text-stone-600">{rangeLabel}</div>

            {goals && goals.kcal > 0 ? (
              <KcalGauge avg={stats.avg.kcal} target={goals.kcal} />
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-3">
                <div className="text-[10px] font-bold text-stone-500 inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-500" strokeWidth={2.4} />
                  平均カロリー
                </div>
                <div className="text-3xl font-bold text-stone-900 mt-1">
                  {stats.avg.kcal}
                  <span className="text-sm font-medium text-stone-500 ml-1">kcal/日</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              <MiniStat
                icon={<CalendarCheck className="w-3 h-3 text-sky-600" strokeWidth={2.4} />}
                label="記録日"
                value={stats.totalDays}
                sub={`日 / ${periodDays}日間`}
                tone="sky"
              />
              <MacroChip macro="P" avg={stats.avg.P} target={goals?.P} color="rose" />
              <MacroChip macro="F" avg={stats.avg.F} target={goals?.F} color="amber" />
              <MacroChip macro="C" avg={stats.avg.C} target={goals?.C} color="violet" />
            </div>
          </section>
        )}

        {/* ---- ② 日別カロリー推移（期間のみ表示） ---- */}
        {!isSingleDay && daily.length > 1 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
            <h3 className="text-sm font-bold text-stone-900 mb-2 inline-flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              日別カロリー
            </h3>
            <DailyKcalChart key={`${customerId}|${rangeLabel}`} daily={daily} targetKcal={goals?.kcal || 0} />
          </section>
        )}

        {/* ---- ③ 食事バランスグラフ ---- */}
        {hasData && ((stats && (stats.avg.P > 0 || stats.avg.F > 0 || stats.avg.C > 0)) || mealTypeKcal) ? (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
            <h3 className="text-sm font-bold text-stone-900 mb-2 inline-flex items-center gap-1.5">
              <TargetIcon className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              食事バランス
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              {mealTypeKcal && Object.values(mealTypeKcal).some((v) => v > 0) && (
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-stone-500 mb-1 text-center">食事区分別カロリー（1日あたり）</div>
                  <MealTypePie mealTypeKcal={mealTypeKcal} totalDays={stats?.totalDays ?? 0} />
                </div>
              )}
              {mealTypeKcal && Object.values(mealTypeKcal).some((v) => v > 0) && (
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-stone-500 mb-1 text-center">食事区分別 PFC（1日あたり）</div>
                  <MealPfcList
                    mealTypeKcal={mealTypeKcal}
                    mealTypeP={mealTypeP ?? {}}
                    mealTypeF={mealTypeF ?? {}}
                    mealTypeC={mealTypeC ?? {}}
                    totalDays={stats?.totalDays ?? 0}
                  />
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* ---- ④ 体重推移 ---- */}
        {hasData && weightLogs.length > 0 && (
          <WeightSection isSingleDay={isSingleDay} weightLogs={weightLogs} target={target} />
        )}

        {/* ---- 体組成推移（体重推移の直下に配置・メイン結果＋当該顧客の体組成フェッチ完了後に表示） ---- */}
        {customerId && !dataLoading && bodyCompFetchedId === customerId && (
          <BodyCompSection
            logs={bodyCompLogs}
            isOpen={bodyCompOpen}
            onToggle={() => {
              bodyCompUserToggledRef.current = true;
              setBodyCompOpen((v) => !v);
            }}
            base={base}
          />
        )}

        {/* ---- ⑤ 運動記録（体組成の下） ---- */}
        {hasData && exerciseLogs.length > 0 && (
          <ExerciseSection exerciseLogs={exerciseLogs} />
        )}

        {/* ---- ⑤ 食事一覧ボタン + AI サマリ作成ボタン ---- */}
        {hasData && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchMealList}
              disabled={mealListLoading || !customerId}
              className="flex-1 bg-sky-500 text-white font-bold py-3 rounded-xl active:bg-sky-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
            >
              {mealListLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                  取得中…
                </>
              ) : (
                <>
                  <UtensilsCrossed className="w-4 h-4" strokeWidth={2.2} />
                  食事一覧を見る
                </>
              )}
            </button>
            <button
              type="button"
              onClick={runAi}
              disabled={aiLoading || !customerId}
              className={`flex-1 ${ac.btn} text-white font-bold py-3 rounded-xl disabled:bg-stone-300 inline-flex items-center justify-center gap-2`}
            >
              {aiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" strokeWidth={2.2} />
                  AI でサマリ作成
                </>
              )}
            </button>
          </div>
        )}

        {/* ---- ⑤-b 食事一覧 ---- */}
        {mealListError && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{mealListError}</div>
        )}
        {mealList !== null && (
          <MealListSection meals={mealList} />
        )}

        {aiError && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{aiError}</div>}
        {aiMessage && <div className="bg-amber-100 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl">{aiMessage}</div>}

        {/* ---- ⑥ AI コメント ---- */}
        {analysis && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
            <button
              type="button"
              onClick={() => setShowInsights((v) => !v)}
              className="w-full flex items-center justify-between p-3 active:bg-stone-50"
            >
              <span className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                AI コメント
              </span>
              {showInsights ? (
                <ChevronUp className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
              )}
            </button>
            {showInsights && (
              <div className="px-3 pb-3 space-y-3">
                {analysis.summary && (
                  <Sub title="総評" icon={<Activity className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />}>
                    <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{analysis.summary}</p>
                  </Sub>
                )}
                {analysis.strengths.length > 0 && (
                  <Sub title="強み" icon={<ThumbsUp className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />}>
                    <Bullets items={analysis.strengths} />
                  </Sub>
                )}
                {analysis.concerns.length > 0 && (
                  <Sub title="懸念点" icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" strokeWidth={2.2} />}>
                    <Bullets items={analysis.concerns} />
                  </Sub>
                )}
                {analysis.patterns.length > 0 && (
                  <Sub title="パターン" icon={<Activity className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.2} />}>
                    <Bullets items={analysis.patterns} />
                  </Sub>
                )}
                {analysis.recommendations.length > 0 && (
                  <Sub title="提案" icon={<Lightbulb className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.2} />}>
                    <Bullets items={analysis.recommendations} />
                  </Sub>
                )}
                {analysis.improvements && analysis.improvements.length > 0 && (
                  <Sub title="改善点" icon={<span className="text-base leading-none">✅</span>}>
                    <Bullets items={analysis.improvements} />
                  </Sub>
                )}
                {analysis.foodAdvice && analysis.foodAdvice.length > 0 && (
                  <Sub title="食材アドバイス" icon={<span className="text-base leading-none">🥬</span>}>
                    <Bullets items={analysis.foodAdvice} />
                  </Sub>
                )}
                {analysis.actionPlan && analysis.actionPlan.length > 0 && (
                  <Sub title="来週のアクションプラン" icon={<span className="text-base leading-none">🎯</span>}>
                    <Bullets items={analysis.actionPlan} />
                  </Sub>
                )}
              </div>
            )}
          </section>
        )}

        {/* ---- ⑦ 顧客送信用ドラフト ---- */}
        {analysis?.reportDraft && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5 mb-2">
              <FileText className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
              顧客送信用ドラフト
            </h2>
            <pre className="text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed font-sans bg-stone-50 border border-stone-200 rounded-xl p-3">
              {analysis.reportDraft}
            </pre>
            {customerId && (
              <div className="mt-3 flex gap-2 flex-wrap">
                <Link
                  href={`${base}/reports?customerId=${customerId}&draft=${encodeURIComponent(analysis.reportDraft)}`}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 ${ac.btn} text-white text-sm font-bold px-3 py-2 rounded-xl`}
                >
                  <Send className="w-4 h-4" strokeWidth={2.2} />
                  レポート送付ページへ
                </Link>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(analysis.reportDraft)}
                  className="inline-flex items-center justify-center gap-1 bg-white border border-stone-300 text-stone-700 text-sm font-bold px-3 py-2 rounded-xl active:bg-stone-50"
                >
                  コピー
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  );
}

// ---- 体重・運動セクション ----

function calcGoalWeight(
  dateStr: string,
  startDate: string,
  targetDate: string,
  startWeight: number,
  targetWeight: number,
): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ty, tm, td] = targetDate.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd).getTime();
  const end = new Date(ty, tm - 1, td).getTime();
  const cur = new Date(dy, dm - 1, dd).getTime();
  if (end <= start) return startWeight;
  const ratio = Math.min(1, Math.max(0, (cur - start) / (end - start)));
  return Math.round((startWeight + (targetWeight - startWeight) * ratio) * 10) / 10;
}

// 初回記録日（startDate）を起点に、対象日が何週目かを返す（7日ごと、0始まり）
function weekIndexOf(dateStr: string, startDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const diffMs = new Date(dy, dm - 1, dd).getTime() - new Date(sy, sm - 1, sd).getTime();
  return Math.floor(Math.floor(diffMs / 86_400_000) / 7);
}

function WeightSection({
  isSingleDay,
  weightLogs,
  target,
}: {
  isSingleDay: boolean;
  weightLogs: WeightLog[];
  target: TargetInfo | null;
}) {
  if (weightLogs.length === 0) return null;

  if (isSingleDay) {
    const w = weightLogs[0];
    return (
      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
        <h3 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
          体重（当日）
        </h3>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center gap-3">
          <Scale className="w-5 h-5 text-sky-600 flex-shrink-0" strokeWidth={2.2} />
          <div>
            <div className="text-2xl font-bold text-sky-900">
              {w.weightKg}
              <span className="text-sm font-medium text-sky-700 ml-1">kg</span>
            </div>
            {w.memo && <div className="text-xs text-sky-700 mt-0.5">{w.memo}</div>}
          </div>
        </div>
      </section>
    );
  }

  const showGoalLine =
    target !== null &&
    target.startDate !== null &&
    target.startWeight !== null &&
    target.targetDate !== null &&
    target.targetWeight !== null &&
    target.startDate < target.targetDate;

  const sortedLogs = weightLogs.slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  // 週平均（初回記録日を起点に7日ごと。初回記録日が無ければ期間内最古を起点）
  const weekStart = target?.startDate ?? sortedLogs[0].date;
  const weekAgg = new Map<number, { sum: number; count: number }>();
  for (const w of sortedLogs) {
    const wi = weekIndexOf(w.date, weekStart);
    const cur = weekAgg.get(wi) ?? { sum: 0, count: 0 };
    cur.sum += w.weightKg;
    cur.count += 1;
    weekAgg.set(wi, cur);
  }
  const weekAvg = new Map<number, number>();
  for (const [wi, v] of weekAgg) {
    weekAvg.set(wi, Math.round((v.sum / v.count) * 10) / 10);
  }

  const weightData = sortedLogs.map((w) => {
    const goalWeight = showGoalLine
      ? calcGoalWeight(
          w.date,
          target!.startDate!,
          target!.targetDate!,
          target!.startWeight!,
          target!.targetWeight!,
        )
      : undefined;
    return {
      fullDate: w.date,
      weight: w.weightKg,
      goalWeight,
      weeklyAvg: weekAvg.get(weekIndexOf(w.date, weekStart)),
    };
  });

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
      <h3 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
        <Scale className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
        体重推移
      </h3>
      <div className="flex items-center gap-4 text-[10px] text-stone-500 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-sky-400" />
          実体重
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-amber-500" />
          週平均
        </span>
        {showGoalLine && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-emerald-500" />
            目標
          </span>
        )}
      </div>
      <div className="w-full h-36">
        <ResponsiveContainer>
          <LineChart data={weightData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="fullDate" tickFormatter={shortDate} interval="preserveStartEnd" tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
              labelFormatter={(l) => shortDate(String(l))}
              formatter={(v, name) => [`${v} kg`, name === 'goalWeight' ? '目標' : name === 'weeklyAvg' ? '週平均' : '実体重']}
            />
            <Line type="monotone" dataKey="weight" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: '#0ea5e9' }} isAnimationActive={false} name="weight" />
            <Line type="stepAfter" dataKey="weeklyAvg" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} name="weeklyAvg" />
            {showGoalLine && (
              <Line type="monotone" dataKey="goalWeight" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} name="goalWeight" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const INTENSITY_ORDER: Record<string, number> = { 高: 3, 中: 2, 低: 1 };

function ExerciseSection({
  exerciseLogs,
}: {
  exerciseLogs: ExerciseLog[];
}) {
  if (exerciseLogs.length === 0) return null;

  const totalMin = exerciseLogs.reduce((a, b) => a + (b.durationMin || 0), 0);
  const totalKcal = exerciseLogs.reduce((a, b) => a + (b.estimatedKcal || 0), 0);

  // 日付昇順、同日内は強度の高い順
  const sorted = exerciseLogs
    .slice()
    .sort((a, b) =>
      a.date !== b.date
        ? (a.date < b.date ? -1 : 1)
        : (INTENSITY_ORDER[b.intensity] ?? 0) - (INTENSITY_ORDER[a.intensity] ?? 0)
    );

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
      <h3 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
        <Dumbbell className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
        運動記録
      </h3>

      {/* 全体サマリ */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 flex flex-wrap gap-x-4 gap-y-1">
        <span>計 {exerciseLogs.length} 回</span>
        {totalMin > 0 && <span>合計 {totalMin} 分</span>}
        {totalKcal > 0 && <span>消費 {Math.round(totalKcal)} kcal</span>}
      </div>

      {/* 記録リスト — 1運動記録を1行（日付＋種目）で表示。時間は表示しない */}
      <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
        {sorted.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
            <span className="min-w-0 truncate">
              <span className="font-bold text-stone-500 mr-2">{shortDate(ex.date)}</span>
              <span className="font-bold text-stone-900">{ex.exercise || '（種目名なし）'}</span>
            </span>
            <span className="flex-shrink-0 flex items-center gap-2 text-stone-500">
              {ex.intensity && <span>{ex.intensity}</span>}
              {ex.estimatedKcal > 0 && <span>{ex.estimatedKcal}kcal</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MealListSection({ meals }: { meals: MealRecord[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, MealRecord[]>();
    for (const m of meals) {
      const arr = map.get(m.date) || [];
      arr.push(m);
      map.set(m.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [meals]);

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
      <h3 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
        <UtensilsCrossed className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
        食事一覧
        <span className="text-[11px] font-medium text-stone-500">（{meals.length}件）</span>
      </h3>
      {meals.length === 0 ? (
        <div className="text-xs text-stone-500 text-center py-4">この期間の食事記録はありません</div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([date, list]) => (
            <div key={date}>
              <div className="text-[11px] font-bold text-stone-600 mb-1">{shortDate(date)}</div>
              <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
                {list.map((m) => {
                  const Icon = ANALYSIS_MEAL_ICON[m.mealType] || UtensilsCrossed;
                  const color = ANALYSIS_MEAL_COLOR[m.mealType] || 'text-stone-500';
                  return (
                    <div key={m.pageId} className="px-3 py-2 text-xs flex items-center gap-2">
                      {m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={toDriveThumbnailUrl(m.imageUrl)}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-stone-100"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <Icon className={`w-4 h-4 ${color}`} strokeWidth={2.2} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} strokeWidth={2.2} />
                          <span className="text-stone-600 flex-shrink-0">{m.mealType || '未分類'}</span>
                          <span className="font-bold text-stone-900 flex-1 truncate">{extractFoodLine(m)}</span>
                        </div>
                        <div className="text-stone-500 mt-0.5">
                          {Math.round(m.kcal)} kcal ・ P{Math.round(m.P * 10) / 10} F{Math.round(m.F * 10) / 10} C{Math.round(m.C * 10) / 10}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- グラフコンポーネント群 ----

function KcalGauge({ avg, target }: { avg: number; target: number }) {
  const pct = Math.min(150, Math.round((avg / target) * 100));
  const tone =
    pct < 85 ? { fg: 'bg-sky-500' }
    : pct > 115 ? { fg: 'bg-rose-500' }
    : { fg: 'bg-emerald-500' };
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3">
      <div>
        <div className="text-[10px] font-bold text-stone-500 inline-flex items-center gap-1">
          <Flame className="w-3 h-3 text-orange-500" strokeWidth={2.4} />
          平均カロリー
        </div>
        <div className="text-3xl font-bold text-stone-900 mt-0.5 leading-none">
          {avg}
          <span className="text-lg font-medium text-stone-400"> / {target}</span>
          <span className="text-sm font-medium text-stone-500 ml-1">kcal</span>
        </div>
      </div>
      <div className="mt-2 relative h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${tone.fg} rounded-full transition-all`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        <div className="absolute left-[66.6%] top-0 w-px h-full bg-stone-400/50" />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone: 'sky' | 'rose' | 'amber' | 'violet';
}) {
  const toneCls =
    tone === 'sky' ? 'bg-sky-50 border-sky-200 text-sky-900'
    : tone === 'rose' ? 'bg-rose-50 border-rose-200 text-rose-900'
    : tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-violet-50 border-violet-200 text-violet-900';
  return (
    <div className={`rounded-xl border p-2 ${toneCls}`}>
      <div className="text-[9px] font-bold inline-flex items-center gap-0.5 opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-base font-bold mt-0.5 leading-none">
        {value}
        {sub && <span className="text-[9px] font-medium opacity-70 ml-0.5">{sub}</span>}
      </div>
    </div>
  );
}

function MacroChip({
  macro,
  avg,
  target,
  color,
}: {
  macro: 'P' | 'F' | 'C';
  avg: number;
  target?: number;
  color: 'rose' | 'amber' | 'violet';
}) {
  const cls =
    color === 'rose' ? 'bg-rose-50 border-rose-200 text-rose-900'
    : color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-violet-50 border-violet-200 text-violet-900';
  const dotCls =
    color === 'rose' ? 'bg-rose-500'
    : color === 'amber' ? 'bg-amber-500'
    : 'bg-violet-500';
  const pct = target && target > 0 ? Math.round((avg / target) * 100) : null;
  return (
    <div className={`rounded-xl border p-2 ${cls}`}>
      <div className="text-[9px] font-bold inline-flex items-center gap-1 opacity-80">
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
        {macro}
      </div>
      <div className="text-base font-bold mt-0.5 leading-none">
        {avg}
        {target !== undefined && target > 0 && (
          <span className="text-[10px] font-medium opacity-50"> / {target}</span>
        )}
        <span className="text-[9px] font-medium opacity-70 ml-0.5">g</span>
      </div>
      {pct !== null && (
        <div className="text-[9px] opacity-70 mt-0.5">{pct}%</div>
      )}
    </div>
  );
}

function DailyKcalChart({ daily, targetKcal }: { daily: Daily[]; targetKcal: number }) {
  // XAxis の dataKey はユニークな YYYY-MM-DD を使う（shortDate は長期間で重複するため）。
  // 棒ごとの色分け (<Cell>) は長期間データで recharts の内部データ順とずれ、
  // 高さ・色・ツールチップが食い違うため使わず、単色 + 目標線で表現する。
  const data = daily.map((d) => ({
    fullDate: d.date,
    kcal: d.kcal ?? 0,
  }));
  return (
    <div className="w-full h-44">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="fullDate"
            tickFormatter={shortDate}
            interval="preserveStartEnd"
            tick={{ fontSize: 10, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
            labelFormatter={(l) =>
              targetKcal > 0
                ? `${shortDate(String(l))} ・ 目標 ${targetKcal}kcal`
                : shortDate(String(l))
            }
            formatter={(v) => [`${v} kcal`, '摂取']}
          />
          {targetKcal > 0 && (
            <ReferenceLine y={targetKcal} stroke="#10b981" strokeDasharray="4 4" />
          )}
          <Bar dataKey="kcal" radius={[4, 4, 0, 0]} fill="#10b981" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 食事区分別 PFC（1日あたり）。レポートと統一し各値は その食事のPFC合計 ÷ 全記録日数。
// %は「その食事の中でのP/F/Cカロリー比率」（合計100%）。
function MealPfcList({
  mealTypeKcal,
  mealTypeP,
  mealTypeF,
  mealTypeC,
  totalDays,
}: {
  mealTypeKcal: Record<string, number>;
  mealTypeP: Record<string, number>;
  mealTypeF: Record<string, number>;
  mealTypeC: Record<string, number>;
  totalDays: number;
}) {
  const order = ['朝食', '昼食', '夕食', '間食'];
  const perDay = (n: number) => (totalDays > 0 ? n / totalDays : 0);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const rows = order
    .filter((m) => (mealTypeKcal[m] ?? 0) > 0)
    .map((m) => {
      const kcal = Math.round(perDay(mealTypeKcal[m] ?? 0));
      const P = r1(perDay(mealTypeP[m] ?? 0));
      const F = r1(perDay(mealTypeF[m] ?? 0));
      const C = r1(perDay(mealTypeC[m] ?? 0));
      const pK = P * 4, fK = F * 9, cK = C * 4;
      const tot = pK + fK + cK;
      const pct = (k: number) => (tot > 0 ? Math.round((k / tot) * 100) : 0);
      return { m, kcal, P, F, C, pP: pct(pK), pF: pct(fK), pC: pct(cK) };
    });

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const Icon = ANALYSIS_MEAL_ICON[row.m];
        const color = ANALYSIS_MEAL_COLOR[row.m] || 'text-stone-500';
        return (
          <div key={row.m} className="text-xs">
            <div className="flex items-center gap-1.5 font-bold text-stone-900">
              {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} strokeWidth={2.2} />}
              <span>{row.m}</span>
              <span className="text-stone-500 font-normal">{row.kcal} kcal</span>
            </div>
            <div className="pl-5 mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-stone-600">
              <span><span className="font-bold text-rose-500">P</span> {row.P}g <span className="text-stone-400">({row.pP}%)</span></span>
              <span><span className="font-bold text-amber-500">F</span> {row.F}g <span className="text-stone-400">({row.pF}%)</span></span>
              <span><span className="font-bold text-violet-500">C</span> {row.C}g <span className="text-stone-400">({row.pC}%)</span></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MEAL_TYPE_COLORS: Record<string, string> = {
  朝食: '#f97316',
  昼食: '#eab308',
  夕食: '#8b5cf6',
  間食: '#ec4899',
};

function MealTypePie({
  mealTypeKcal,
  totalDays,
}: {
  mealTypeKcal: Record<string, number>;
  totalDays: number;
}) {
  // レポートと統一: 各食事 = その食事のkcal合計 ÷ 全記録日数（＝1日あたり平均）。
  // これで朝+昼+夕+間 を足すと上部の「平均カロリー」と一致する。
  const avgKcal = Object.fromEntries(
    Object.entries(mealTypeKcal).map(([name, total]) => {
      return [name, totalDays > 0 ? Math.round(total / totalDays) : 0];
    })
  );
  const totalAvg = Object.values(avgKcal).reduce((a, b) => a + b, 0);
  const data = totalAvg > 0
    ? Object.entries(avgKcal)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({
          name,
          value: Math.round((value / totalAvg) * 100),
          color: MEAL_TYPE_COLORS[name] || '#a8a29e',
        }))
    : [];

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-32 flex-shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={32}
              outerRadius={56}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="font-bold text-stone-900 w-6">{d.name.slice(0, 2)}</span>
            <span className="text-stone-600 flex-1">
              {avgKcal[d.name]} kcal
            </span>
            <span className="font-bold text-stone-900 text-[11px] w-9 text-right">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sub({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
      <h3 className="text-[11px] font-bold text-stone-700 flex items-center gap-1 mb-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1">
      {items.map((s, i) => (
        <li key={i} className="text-sm text-stone-800 leading-relaxed flex gap-2">
          <span className="text-stone-400 flex-shrink-0">・</span>
          <span className="whitespace-pre-wrap break-words">{s}</span>
        </li>
      ))}
    </ul>
  );
}

function BodyCompSection({
  logs,
  isOpen,
  onToggle,
  base,
}: {
  logs: BodyCompLog[];
  isOpen: boolean;
  onToggle: () => void;
  base: string;
}) {
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // axis: 'kg'(左軸) / 'pct'(右軸=%・BMI・内臓脂肪レベル) / 'kcal'(基礎代謝専用の隠し軸=自分のスケールで推移を表示)。
  // 全項目を1グラフに線で表示できるが、スケール差を壊さないため軸を分ける。invert=true は「下がると良い」項目。
  const METRICS: { key: keyof BodyCompLog; label: string; unit: string; color: string; invert: boolean; axis: 'kg' | 'pct' | 'kcal' }[] = [
    { key: 'weightKg', label: '体重', unit: 'kg', color: '#0ea5e9', invert: true, axis: 'kg' },
    { key: 'bodyFatPct', label: '体脂肪率', unit: '%', color: '#f59e0b', invert: true, axis: 'pct' },
    { key: 'muscleMassKg', label: '筋肉量', unit: 'kg', color: '#10b981', invert: false, axis: 'kg' },
    { key: 'bodyFatMassKg', label: '体脂肪量', unit: 'kg', color: '#fb923c', invert: true, axis: 'kg' },
    { key: 'bodyWaterPct', label: '体水分率', unit: '%', color: '#06b6d4', invert: false, axis: 'pct' },
    { key: 'bmi', label: 'BMI', unit: '', color: '#a855f7', invert: true, axis: 'pct' },
    { key: 'basalMetabolicKcal', label: '基礎代謝', unit: 'kcal', color: '#ef4444', invert: false, axis: 'kcal' },
    { key: 'visceralFatLevel', label: '内臓脂肪レベル', unit: '', color: '#f97316', invert: true, axis: 'pct' },
    { key: 'skeletalMuscleMassKg', label: '骨格筋量', unit: 'kg', color: '#22c55e', invert: false, axis: 'kg' },
    { key: 'rightArmMuscleKg', label: '右腕筋肉量', unit: 'kg', color: '#2dd4bf', invert: false, axis: 'kg' },
    { key: 'leftArmMuscleKg', label: '左腕筋肉量', unit: 'kg', color: '#2dd4bf', invert: false, axis: 'kg' },
    { key: 'rightLegMuscleKg', label: '右脚筋肉量', unit: 'kg', color: '#0d9488', invert: false, axis: 'kg' },
    { key: 'leftLegMuscleKg', label: '左脚筋肉量', unit: 'kg', color: '#0d9488', invert: false, axis: 'kg' },
    { key: 'trunkMuscleKg', label: '体幹筋肉量', unit: 'kg', color: '#0891b2', invert: false, axis: 'kg' },
  ];

  const sorted = logs.slice().sort((a, b) => (a.measureDate < b.measureDate ? -1 : 1));

  // 各項目の最新値・初回比増減・記録点数を算出（記録のある項目のみ）。
  const metricInfo = METRICS.map((m) => {
    const vals = sorted
      .map((l) => l[m.key] as number | null)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    const baseline = vals.length > 0 ? vals[0] : null;
    const latest = vals.length > 0 ? vals[vals.length - 1] : null;
    const deltaVal = vals.length >= 2 && latest !== null && baseline !== null ? round1(latest - baseline) : null;
    return { ...m, count: vals.length, latest, deltaVal };
  }).filter((m) => m.count > 0);

  // 既定は全項目を線表示。凡例チェックを外すと非表示にできる。
  const [visible, setVisible] = useState<Set<string>>(() => new Set(METRICS.map((m) => m.key as string)));
  const toggleMetric = (k: string) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // ワイド形式の chartData（1行=1計測日、各 key に実数値）。
  const chartData = sorted.map((l) => {
    const row: Record<string, number | string> = { fullDate: l.measureDate };
    for (const m of METRICS) {
      const v = l[m.key] as number | null;
      if (typeof v === 'number' && !Number.isNaN(v)) row[m.key] = v;
    }
    return row;
  });

  // 表示中の左軸(kg)系列の実データから domain を算出（四肢 ON 時に体重が潰れる挙動を明示制御）。
  const leftDomain = useMemo<[number, number | 'auto']>(() => {
    const vals: number[] = [];
    for (const l of sorted)
      for (const m of METRICS)
        if (m.axis === 'kg' && visible.has(m.key as string)) {
          const v = l[m.key] as number | null;
          if (typeof v === 'number' && !Number.isNaN(v)) vals.push(v);
        }
    if (!vals.length) return [0, 'auto'];
    return [Math.max(0, Math.floor(Math.min(...vals) - 2)), Math.ceil(Math.max(...vals) + 2)];
  }, [sorted, visible]);

  const lineMetrics = metricInfo; // 全項目が線として表示可能（軸は kg/pct/kcal に振り分け）
  const dataKeys = new Set(metricInfo.map((m) => m.key as string));
  const canChart = sorted.length >= 2 && lineMetrics.length > 0;
  // 実際に描画される軸だけ表示（その系列を全部OFFにした時に空の軸が残らないように）
  const axisActive = (axis: 'kg' | 'pct' | 'kcal') =>
    METRICS.some((m) => m.axis === axis && visible.has(m.key as string) && dataKeys.has(m.key as string));
  const hasKgAxis = axisActive('kg');
  const hasPctAxis = axisActive('pct');
  const hasKcalAxis = axisActive('kcal');

  function DeltaBadge({ v, unit, invert }: { v: number | null; unit: string; invert?: boolean }) {
    if (v === null) return null;
    const positive = invert ? v < 0 : v > 0;
    const cls = v === 0 ? 'text-stone-500' : positive ? 'text-emerald-600' : 'text-rose-500';
    return (
      <span className={`text-[10px] font-bold ml-1 ${cls}`}>
        {v > 0 ? '+' : ''}{v}{unit}
      </span>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 active:bg-stone-50"
      >
        <span className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
          体組成推移
          {logs.length > 0 && (
            <span className="text-[11px] font-medium text-stone-500">（{logs.length}件）</span>
          )}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-500" strokeWidth={2.4} />
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {logs.length === 0 ? (
            <div className="text-xs text-stone-500 text-center py-4">体組成記録がありません</div>
          ) : (
            <>
              {/* 統合グラフ（左軸=kg / 右軸=%・BMI・内臓脂肪 / 基礎代謝は隠しkcal軸・実数値のまま）。2回以上の計測で表示 */}
              {canChart ? (
                <div className="w-full h-56">
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                      <XAxis dataKey="fullDate" tickFormatter={shortDate} interval="preserveStartEnd" tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} />
                      {hasKgAxis && (
                        <YAxis yAxisId="kg" domain={leftDomain} width={28} tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} />
                      )}
                      {hasPctAxis && (
                        <YAxis yAxisId="pct" orientation="right" domain={[0, 'auto']} width={24} tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} />
                      )}
                      {/* 基礎代謝(kcal)は桁違いなので専用の隠し軸で自分のスケールに合わせて推移だけ描画 */}
                      {hasKcalAxis && <YAxis yAxisId="kcal" hide domain={['auto', 'auto']} />}
                      <Tooltip
                        contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e7e5e4', backgroundColor: '#fafaf8' }}
                        labelFormatter={(l) => shortDate(String(l))}
                        formatter={(value, name) => {
                          const m = METRICS.find((x) => x.key === name);
                          return m ? [`${round1(Number(value))}${m.unit}`, m.label] : [value as number, String(name)];
                        }}
                      />
                      {METRICS.filter((m) => visible.has(m.key as string) && dataKeys.has(m.key as string)).map((m) => (
                        <Line key={m.key} yAxisId={m.axis} type="linear" dataKey={m.key as string} name={m.key as string} stroke={m.color} strokeWidth={2} dot={{ r: 2.5, fill: m.color }} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-[11px] text-stone-400">推移グラフは2回以上の計測で表示されます</div>
              )}

              {/* 凡例（チェックで線を表示切替）＋最新の実数値・増減 */}
              {lineMetrics.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-stone-400">既定は全項目を表示。チェックを外すとグラフから非表示（基礎代謝・BMI・内臓脂肪レベルも各スケールで表示。実数値はホバー/右の数値）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                    {lineMetrics.map((m) => {
                      const on = visible.has(m.key as string);
                      const selectable = m.count >= 2;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => selectable && toggleMetric(m.key as string)}
                          disabled={!selectable}
                          aria-pressed={on}
                          className={`flex items-center gap-1.5 min-w-0 py-1 text-left ${selectable ? '' : 'opacity-50 cursor-default'}`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'border-transparent' : 'border-stone-300 bg-white'}`}
                            style={on ? { backgroundColor: m.color } : undefined}
                          >
                            {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </span>
                          <span className="text-[11px] text-stone-600 truncate">{m.label}</span>
                          <span className="text-[11px] font-bold text-stone-900 ml-auto whitespace-nowrap">
                            {m.latest !== null ? round1(m.latest) : '—'}{m.unit}
                            <DeltaBadge v={m.deltaVal} unit={m.unit} invert={m.invert} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </>
          )}

          <Link
            href={`${base}/measurements`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.2} />
            体組成計測記録を見る
          </Link>
        </div>
      )}
    </section>
  );
}
