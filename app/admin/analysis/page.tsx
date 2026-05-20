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
  Flame,
  Target as TargetIcon,
  CalendarCheck,
  Hourglass,
  Scale,
  Dumbbell,
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
import DateRangePicker from '../DateRangePicker';
import { useAdminBase } from '@/lib/useAdminBase';

type Customer = { pageId: string; name: string; foodStatus: string | null; storeId: string | null };

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
type TargetInfo = { currentWeight: number | null; targetWeight: number | null; targetDate: string | null };

type WeightLog = {
  id: string;
  date: string;
  weightKg: number;
  memo: string;
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
  const initialCustomerId = sp.get('customerId') || '';
  const today = jstToday();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);

  // グラフ用データ（data API）
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [mealTypeKcal, setMealTypeKcal] = useState<Record<string, number> | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [target, setTarget] = useState<TargetInfo | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // AI サマリ
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);

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
        const res = await fetch('/api/admin/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setCustomers((j.customers || []).filter((c: Customer) => !!c.foodStatus));
      } catch (e) {
        setDataError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  // 店舗一覧（ユニーク）
  const storeOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: '', label: 'すべての店舗' }];
    for (const c of customers) {
      const key = c.storeId ?? '';
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ value: key, label: key === '' ? '店舗未設定' : key });
      }
    }
    return opts;
  }, [customers]);

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
    setGoals(null);
    setTarget(null);
    setWeightLogs([]);
    setExerciseLogs([]);
    setRangeLabel('');
    setAnalysis(null);
    setAiError(null);
    setAiMessage(null);
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

  async function runAi() {
    if (!customerId) return;
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

  const hasData = !!stats;

  return (
    <AdminShell title="顧客分析">
      <div className="space-y-3">
        {/* 店舗フィルタ */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">店舗</label>
            <select
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                // 絞り込みで現在の顧客が外れたらクリア
                const newFiltered = customers.filter((c) =>
                  e.target.value === '' ? true : (c.storeId ?? '') === e.target.value
                );
                if (customerId && !newFiltered.find((c) => c.pageId === customerId)) {
                  setCustomerId('');
                }
              }}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {storeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 顧客選択 */}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">顧客</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">選択してください</option>
              {filteredCustomers.map((c) => (
                <option key={c.pageId} value={c.pageId}>
                  {c.name}
                </option>
              ))}
            </select>
            {loadingCustomers && <div className="text-[11px] text-stone-500 mt-1">顧客読み込み中…</div>}
          </div>
        </section>

        {/* 期間 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <DateRangePicker
            from={from}
            to={to}
            today={today}
            onChangeFrom={setFrom}
            onChangeTo={setTo}
            onShift={shiftRange}
            isSingleDay={isSingleDay}
          />
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
                sub={`/${periodDays}日`}
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
            <DailyKcalChart key={rangeLabel} daily={daily} targetKcal={goals?.kcal || 0} />
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
                  <div className="text-[10px] font-bold text-stone-500 mb-1 text-center">食事区分別カロリー</div>
                  <MealTypePie mealTypeKcal={mealTypeKcal} />
                </div>
              )}
              {stats && (stats.avg.P > 0 || stats.avg.F > 0 || stats.avg.C > 0) && (
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-stone-500 mb-1 text-center">PFC バランス</div>
                  <PfcPie avg={stats.avg} target={goals} />
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* ---- ④ 体重 ---- */}
        {hasData && weightLogs.length > 0 && (
          <WeightSection isSingleDay={isSingleDay} weightLogs={weightLogs} />
        )}

        {/* ---- ⑤ 運動記録 ---- */}
        {hasData && exerciseLogs.length > 0 && (
          <ExerciseSection exerciseLogs={exerciseLogs} />
        )}

        {/* ---- ⑤ AI サマリ作成ボタン ---- */}
        {hasData && (
          <button
            type="button"
            onClick={runAi}
            disabled={aiLoading || !customerId}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                サマリ生成中…（10〜20秒）
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" strokeWidth={2.2} />
                AI でサマリ作成
              </>
            )}
          </button>
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
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl active:bg-emerald-700"
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

function WeightSection({
  isSingleDay,
  weightLogs,
}: {
  isSingleDay: boolean;
  weightLogs: WeightLog[];
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

  const weightData = weightLogs
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((w) => ({ fullDate: w.date, weight: w.weightKg }));

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
      <h3 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
        <Scale className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
        体重推移
      </h3>
      <div className="w-full h-36">
        <ResponsiveContainer>
          <LineChart data={weightData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="fullDate" tickFormatter={shortDate} interval="preserveStartEnd" tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [`${v} kg`, '']} />
            <Line type="monotone" dataKey="weight" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: '#0ea5e9' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const INTENSITY_ORDER: Record<string, number> = { 高: 3, 中: 2, 低: 1 };

function ExerciseSection({ exerciseLogs }: { exerciseLogs: ExerciseLog[] }) {
  if (exerciseLogs.length === 0) return null;

  const totalMin = exerciseLogs.reduce((a, b) => a + b.durationMin, 0);
  const totalKcal = exerciseLogs.reduce((a, b) => a + b.estimatedKcal, 0);

  // 種目別の集計（回数・合計時間・合計消費kcal）
  const byExercise = new Map<string, { count: number; min: number; kcal: number }>();
  for (const ex of exerciseLogs) {
    const key = ex.exercise || '（種目名なし）';
    const cur = byExercise.get(key) || { count: 0, min: 0, kcal: 0 };
    cur.count += 1;
    cur.min += ex.durationMin;
    cur.kcal += ex.estimatedKcal;
    byExercise.set(key, cur);
  }
  const exerciseSummary = Array.from(byExercise.entries()).sort((a, b) => b[1].count - a[1].count);

  // 日付降順の記録リスト（同日内は強度の高い順）
  const sorted = exerciseLogs
    .slice()
    .sort((a, b) =>
      a.date !== b.date
        ? (a.date < b.date ? 1 : -1)
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
        <span>合計 {totalMin} 分</span>
        <span>消費 {Math.round(totalKcal)} kcal</span>
      </div>

      {/* 種目別集計 */}
      {exerciseSummary.length > 1 && (
        <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
          {exerciseSummary.map(([name, v]) => (
            <div key={name} className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="font-bold text-stone-800">{name}</span>
              <span className="text-stone-500">
                {v.count}回 ・ {v.min}分 ・ {Math.round(v.kcal)}kcal
              </span>
            </div>
          ))}
        </div>
      )}

      {/* いつ・何を — 日付順の記録リスト */}
      <div className="space-y-1.5">
        {sorted.map((ex) => (
          <div key={ex.id} className="border border-stone-200 rounded-xl p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900">{ex.exercise || '（種目名なし）'}</span>
              <span className="text-stone-400">{shortDate(ex.date)}</span>
            </div>
            <div className="text-stone-600 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              <span>{ex.durationMin}分</span>
              {ex.intensity && <span>強度: {ex.intensity}</span>}
              {ex.estimatedKcal > 0 && <span>消費 {ex.estimatedKcal} kcal</span>}
              {ex.category && <span className="text-emerald-600">{ex.category}</span>}
            </div>
            {ex.memo && <div className="text-stone-400 mt-0.5">{ex.memo}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- グラフコンポーネント群 ----

function KcalGauge({ avg, target }: { avg: number; target: number }) {
  const pct = Math.min(150, Math.round((avg / target) * 100));
  const tone =
    pct < 85 ? { fg: 'bg-sky-500', text: 'text-sky-700', label: '不足ぎみ' }
    : pct > 115 ? { fg: 'bg-rose-500', text: 'text-rose-700', label: 'オーバー' }
    : { fg: 'bg-emerald-500', text: 'text-emerald-700', label: '目標範囲内' };
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold text-stone-500 inline-flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" strokeWidth={2.4} />
            平均カロリー
          </div>
          <div className="text-3xl font-bold text-stone-900 mt-0.5 leading-none">
            {avg}
            <span className="text-sm font-medium text-stone-500 ml-1">kcal</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">目標 {target} kcal</div>
        </div>
        <div className={`text-right ${tone.text}`}>
          <div className="text-2xl font-bold leading-none">{pct}%</div>
          <div className="text-[10px] font-bold mt-0.5">{tone.label}</div>
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
        <span className="text-[9px] font-medium opacity-70 ml-0.5">g</span>
      </div>
      {pct !== null && (
        <div className="text-[9px] opacity-70 mt-0.5">{pct}%</div>
      )}
    </div>
  );
}

function DailyKcalChart({ daily, targetKcal }: { daily: Daily[]; targetKcal: number }) {
  // XAxis の dataKey はユニークな YYYY-MM-DD を使う。
  // shortDate (M/D) は長期間で重複し recharts のカテゴリ軸・Cell 対応が崩れるため。
  const data = daily.map((d) => ({
    fullDate: d.date,
    kcal: d.kcal ?? 0,
    has: d.kcal !== null,
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
            labelFormatter={(l) => shortDate(String(l))}
            formatter={(v) => [`${v} kcal`, '']}
          />
          {targetKcal > 0 && (
            <ReferenceLine
              y={targetKcal}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{ value: `目標 ${targetKcal}`, fontSize: 9, fill: '#10b981', position: 'insideTopRight' }}
            />
          )}
          <Bar dataKey="kcal" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.fullDate}
                fill={
                  !d.has ? '#e7e5e4'
                  : targetKcal > 0 && d.kcal > targetKcal * 1.15 ? '#fb7185'
                  : targetKcal > 0 && d.kcal < targetKcal * 0.85 ? '#7dd3fc'
                  : '#10b981'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PfcPie({
  avg,
  target,
}: {
  avg: { P: number; F: number; C: number };
  target: Goals | null;
}) {
  const pK = avg.P * 4;
  const fK = avg.F * 9;
  const cK = avg.C * 4;
  const totalK = pK + fK + cK;
  const data = totalK > 0 ? [
    { name: 'P', value: Math.round((pK / totalK) * 100), color: '#f43f5e' },
    { name: 'F', value: Math.round((fK / totalK) * 100), color: '#f59e0b' },
    { name: 'C', value: Math.round((cK / totalK) * 100), color: '#8b5cf6' },
  ] : [];

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
        {data.map((d) => {
          const macroAvg = d.name === 'P' ? avg.P : d.name === 'F' ? avg.F : avg.C;
          const macroTarget = target ? (d.name === 'P' ? target.P : d.name === 'F' ? target.F : target.C) : 0;
          return (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="font-bold text-stone-900 w-3">{d.name}</span>
              <span className="text-stone-600 flex-1">
                {macroAvg}g
                {macroTarget > 0 && <span className="text-stone-400 ml-1">/ {macroTarget}g</span>}
              </span>
              <span className="font-bold text-stone-900 text-[11px] w-9 text-right">{d.value}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MEAL_TYPE_COLORS: Record<string, string> = {
  朝食: '#f97316',
  昼食: '#eab308',
  夕食: '#8b5cf6',
  間食: '#ec4899',
};

function MealTypePie({ mealTypeKcal }: { mealTypeKcal: Record<string, number> }) {
  const total = Object.values(mealTypeKcal).reduce((a, b) => a + b, 0);
  const data = total > 0
    ? Object.entries(mealTypeKcal)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({
          name,
          value: Math.round((value / total) * 100),
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
              {Math.round(mealTypeKcal[d.name])}kcal
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
