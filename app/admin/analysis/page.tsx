'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
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
} from 'recharts';
import AdminShell from '../AdminShell';
import DateRangePicker from '../DateRangePicker';

type Customer = { pageId: string; name: string; foodStatus: string | null };

type Analysis = {
  summary: string;
  strengths: string[];
  concerns: string[];
  patterns: string[];
  recommendations: string[];
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
  const initialCustomerId = sp.get('customerId') || '';
  const today = jstToday();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [from, setFrom] = useState<string>(addDaysStr(today, -29));
  const [to, setTo] = useState<string>(today);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [target, setTarget] = useState<TargetInfo | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setCustomers((j.customers || []).filter((c: Customer) => !!c.foodStatus));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  const startDate = from;
  const endDate = to;
  const isSingleDay = from === to;
  const periodDays = useMemo(() => diffDays(startDate, endDate), [startDate, endDate]);

  function shiftRange(delta: number) {
    setFrom(addDaysStr(from, delta));
    setTo(addDaysStr(to, delta));
  }

  async function run() {
    if (!customerId) {
      setError('顧客を選択してください');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setAnalysis(null);
    setStats(null);
    setDaily([]);
    setGoals(null);
    setTarget(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: periodDays }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `分析失敗（${res.status}）`);
      }
      const j = await res.json();
      setAnalysis(j.analysis);
      setStats(j.stats);
      setDaily(j.daily || []);
      setGoals(j.goals || null);
      setTarget(j.target || null);
      setRangeLabel(j.rangeLabel || '');
      if (j.message) setMessage(j.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell title="AI 分析">
      <div className="space-y-3">
        {/* 顧客選択 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <label className="text-xs font-bold text-stone-700 mb-1 block">顧客</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">選択してください</option>
            {customers.map((c) => (
              <option key={c.pageId} value={c.pageId}>
                {c.name}
              </option>
            ))}
          </select>
          {loadingCustomers && <div className="text-[11px] text-stone-500 mt-1">顧客読み込み中…</div>}
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

        <button
          type="button"
          onClick={run}
          disabled={loading || !customerId}
          className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
              分析中…（10〜20秒）
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" strokeWidth={2.2} />
              AI で分析する
            </>
          )}
        </button>

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}
        {message && <div className="bg-amber-100 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl">{message}</div>}

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

        {/* ---- ① 数値ハイライト（先に見える） ---- */}
        {stats && (
          <section className="bg-gradient-to-br from-emerald-50 to-sky-50 rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-3">
            <div className="text-[11px] font-bold text-stone-600">{rangeLabel}</div>

            {/* 平均カロリー vs 目標 */}
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

            {/* 記録率 + PFC ミニカード */}
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

        {/* ---- ② 日別カロリー推移 ---- */}
        {daily.length > 1 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
            <h3 className="text-sm font-bold text-stone-900 mb-2 inline-flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              日別カロリー
            </h3>
            <DailyKcalChart daily={daily} targetKcal={goals?.kcal || 0} />
          </section>
        )}

        {/* ---- ③ PFC バランス ---- */}
        {stats && (stats.avg.P > 0 || stats.avg.F > 0 || stats.avg.C > 0) && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
            <h3 className="text-sm font-bold text-stone-900 mb-2 inline-flex items-center gap-1.5">
              <TargetIcon className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              PFC バランス
            </h3>
            <PfcPie avg={stats.avg} target={goals} />
          </section>
        )}

        {/* ---- ④ AIテキスト分析（折りたたみ可・グラフより下） ---- */}
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
              </div>
            )}
          </section>
        )}

        {/* ---- ⑤ 顧客送信用ドラフト ---- */}
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
                  href={`/admin/reports?customerId=${customerId}&draft=${encodeURIComponent(analysis.reportDraft)}`}
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
        {/* 目標ライン（100%）— 目盛 */}
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
  const data = daily.map((d) => ({
    date: shortDate(d.date),
    kcal: d.kcal ?? 0,
    has: d.kcal !== null,
  }));
  return (
    <div className="w-full h-44">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="date"
            interval="preserveStartEnd"
            tick={{ fontSize: 10, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
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
          <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
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
  // kcal 換算: P×4, F×9, C×4
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
