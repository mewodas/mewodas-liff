'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached } from '@/lib/clientCache';
import PageHeader from '@/components/PageHeader';
import MealRatioChart from '@/components/MealRatioChart';
import {
  TrendingUp,
  BarChart3,
  CalendarRange,
  Flame,
  ClipboardList,
  Footprints,
  Scale,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

type DailyAgg = {
  date: string;
  weekday: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
  weight?: string;
  exercised?: boolean;
};

type WeeklyData = {
  customer: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
    currentWeight: number | null;
    targetWeight: number | null;
    targetDate: string | null;
  };
  week: {
    offset: number;
    startDate: string;
    endDate: string;
    daily: DailyAgg[];
    sum: { kcal: number; P: number; F: number; C: number };
    avg: { kcal: number; P: number; F: number; C: number };
    recordedDays: number;
    exerciseDays: number;
    mealRatio?: Record<string, number>;
  };
};

export default function WeeklyPage() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (!profile) {
          setError('LINEプロフィール取得失敗');
          setReady(true);
          return;
        }
        setUserId(profile.userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const cacheKey = `weekly_v2_${userId}_${offset}`;
    const cached = getCached<WeeklyData>(cacheKey);
    if (cached) {
      setData(cached.data);
      setReady(true);
      if (!cached.isStale) {
        setError(null);
        return;
      }
    } else {
      setReady(false);
    }
    (async () => {
      try {
        const res = await fetch(`/api/weekly?lineUserId=${encodeURIComponent(userId)}&offset=${offset}&t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `データ取得失敗（${res.status}）`);
        }
        const json = await res.json();
        setData(json);
        setCached(cacheKey, json);
        setError(null);
      } catch (e) {
        if (!cached) setError(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setReady(true);
      }
    })();
  }, [userId, offset]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl text-sm mb-4">
            {error || 'データなし'}
          </div>
          <Link href="/home" className="block bg-emerald-500 text-white text-center font-bold py-3 rounded-xl">
            ホームへ
          </Link>
        </div>
      </main>
    );
  }

  const { customer, week } = data;
  const { goals } = customer;
  const weekLabel = `${fmtJp(week.startDate)} 〜 ${fmtJp(week.endDate)}`;
  const offsetLabel = offset === 0 ? '今週' : offset === -1 ? '先週' : offset > 0 ? `${offset}週後` : `${-offset}週前`;

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader
        title="週次レポート"
        Icon={TrendingUp}
        subtitle={`${offsetLabel}：${weekLabel}`}
        back
      />
      <div className="max-w-md mx-auto px-4 py-6">
        {/* 週ナビゲーション（過去のみ） */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setOffset(offset - 1)}
            className="flex-1 bg-white border border-stone-300 text-stone-900 font-bold py-2 rounded-xl text-sm active:bg-stone-50"
          >
            ← 前週
          </button>
          {offset !== 0 && (
            <>
              <button
                onClick={() => setOffset(0)}
                className="px-4 bg-emerald-500 text-white font-bold py-2 rounded-xl text-sm"
              >
                今週
              </button>
              <button
                onClick={() => setOffset(offset + 1)}
                className="flex-1 bg-white border border-stone-300 text-stone-900 font-bold py-2 rounded-xl text-sm active:bg-stone-50"
              >
                翌週 →
              </button>
            </>
          )}
        </div>

        {/* 週次サマリ（履歴と同じレイアウト） */}
        <WeeklySummary daily={week.daily} recordedDays={week.recordedDays} exerciseDays={week.exerciseDays} avgKcal={week.avg.kcal} />

        {/* 食事ごとの割合（円グラフ） */}
        {week.mealRatio && (
          <MealRatioChart mealRatio={week.mealRatio} title="今週の食事割合" />
        )}

        {/* 週間平均（PFCバランス含む詳細） */}
        <WeeklyNutritionSummary avg={week.avg} goals={goals} recordedDays={week.recordedDays} exerciseDays={week.exerciseDays} />

        {/* 日別カロリーグラフ */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-emerald-600" strokeWidth={2.2}/>
            日別カロリー
          </h2>
          <DailyKcalChart
            data={week.daily}
            goal={goals.kcal}
            avg={week.avg.kcal}
          />
          <div className="mt-3 flex items-center gap-4 text-sm flex-wrap font-bold">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="inline-block w-4 border-t-2 border-dashed border-emerald-500" />
              目標 {goals.kcal} kcal
            </span>
            {week.avg.kcal > 0 && (
              <span className="inline-flex items-center gap-1.5 text-purple-700">
                <span className="inline-block w-4 border-t-2 border-dashed border-purple-500" />
                平均 {week.avg.kcal} kcal
              </span>
            )}
          </div>
        </div>

        {/* 日別詳細リスト */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-stone-700" strokeWidth={2.2}/>
            日別詳細
          </h2>
          <div className="space-y-1">
            {week.daily.map((d) => (
              <div key={d.date} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-b-0">
                <span className="font-medium text-stone-800 text-sm">
                  {fmtMd(d.date)}（{d.weekday}）
                </span>
                {d.recorded ? (
                  <div className="text-right">
                    <div className="font-bold text-stone-900 text-sm">{d.kcal} kcal</div>
                    <div className="text-xs text-stone-600">
                      P{d.P} F{d.F} C{d.C}
                    </div>
                  </div>
                ) : (
                  <span className="text-stone-400 text-sm">未記録</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function DailyKcalChart({
  data,
  goal,
  avg,
}: {
  data: DailyAgg[];
  goal: number;
  avg: number;
}) {
  const maxKcal = Math.max(...data.map((d) => d.kcal), goal, avg, 100);
  // 「キリのいい」最大値に丸める（1000単位、最低でも目標の1.2倍）
  const scaleBase = Math.max(maxKcal * 1.05, goal * 1.2);
  const maxScale = Math.ceil(scaleBase / 1000) * 1000;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxScale * p));

  return (
    <div className="w-full h-56 relative select-none">
      {/* Y軸目盛 */}
      <div className="absolute left-0 top-0 bottom-7 w-12 flex flex-col-reverse justify-between text-[10px] text-stone-500 pr-1 text-right">
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1.5">
            {t}
          </span>
        ))}
      </div>

      {/* チャート本体 */}
      <div className="absolute left-12 right-1 top-0 bottom-7 border-l border-b border-stone-300">
        {/* Y軸グリッド */}
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <div
            key={p}
            className="absolute left-0 right-0 border-t border-dashed border-stone-200"
            style={{ bottom: `${p * 100}%` }}
          />
        ))}

        {/* 目標ライン */}
        {goal > 0 && goal <= maxScale && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-emerald-500 pointer-events-none"
            style={{ bottom: `${(goal / maxScale) * 100}%` }}
          />
        )}

        {/* 平均ライン */}
        {avg > 0 && avg <= maxScale && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-purple-500 pointer-events-none"
            style={{ bottom: `${(avg / maxScale) * 100}%` }}
          />
        )}

        {/* バー */}
        <div className="absolute inset-0 flex items-end justify-around px-1">
          {data.map((d) => {
            const heightPct = (d.kcal / maxScale) * 100;
            return (
              <div
                key={d.date}
                className="relative flex items-end justify-center"
                style={{
                  width: `${100 / data.length - 2}%`,
                  height: '100%',
                }}
              >
                {d.kcal > 0 && (
                  <div
                    className="w-full rounded-t-md bg-orange-400"
                    style={{ height: `${heightPct}%`, minHeight: '2px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* X軸ラベル */}
      <div className="absolute left-12 right-1 bottom-0 h-7 flex items-center justify-around px-1">
        {data.map((d) => (
          <div
            key={d.date}
            className="text-xs text-center font-medium text-stone-700"
            style={{ width: `${100 / data.length - 2}%` }}
          >
            {d.weekday}
          </div>
        ))}
      </div>
    </div>
  );
}

// 履歴の MonthlySummary と同じレイアウト（週次バージョン）
function WeeklySummary({
  daily,
  recordedDays,
  exerciseDays,
  avgKcal,
}: {
  daily: DailyAgg[];
  recordedDays: number;
  exerciseDays: number;
  avgKcal: number;
}) {
  const weightDays = daily.filter(
    (d) => d.weight && !isNaN(parseFloat(d.weight))
  );
  const firstWeight = weightDays.length > 0 ? parseFloat(weightDays[0].weight!) : null;
  const lastWeight =
    weightDays.length > 0 ? parseFloat(weightDays[weightDays.length - 1].weight!) : null;
  const weightDelta =
    firstWeight !== null && lastWeight !== null
      ? Math.round((lastWeight - firstWeight) * 10) / 10
      : null;
  const weightSign = weightDelta === null ? '' : weightDelta > 0 ? '+' : '';
  const weightDisplay = weightDelta === null ? '—' : `${weightSign}${weightDelta}`;

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <BarChart3 className="w-4 h-4 text-stone-700" strokeWidth={2.2}/>
        週次サマリ
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <SummaryBox
          Icon={ClipboardList}
          iconColor="text-sky-600"
          label="食事を記録した日数"
          value={`${recordedDays}/7`}
          unit="日"
        />
        <SummaryBox
          Icon={Footprints}
          iconColor="text-amber-600"
          label="運動した日数"
          value={`${exerciseDays}/7`}
          unit="日"
        />
        <SummaryBox
          Icon={Scale}
          iconColor="text-sky-600"
          label="体重の増減"
          value={weightDisplay}
          unit={weightDelta !== null ? 'kg' : ''}
        />
        <SummaryBox
          Icon={Flame}
          iconColor="text-emerald-600"
          label="1日あたり平均"
          value={avgKcal > 0 ? `${Math.round(avgKcal)}` : '—'}
          unit={avgKcal > 0 ? 'kcal' : ''}
        />
      </div>
      {weightDelta !== null && weightDays.length >= 2 && (
        <p className="text-[10px] text-stone-500 mt-2 leading-relaxed">
          <span className="inline-flex items-center gap-1"><Scale className="w-3 h-3" strokeWidth={2.2}/>{firstWeight}kg（最初）→ {lastWeight}kg（最新）／{weightDays.length}回測定</span>
        </p>
      )}
    </div>
  );
}

function SummaryBox({
  Icon,
  iconColor,
  label,
  value,
  unit,
}: {
  Icon?: LucideIcon;
  iconColor?: string;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
      <div className="text-xs font-medium text-stone-700 flex items-center gap-1">
        {Icon && <Icon className={`w-3.5 h-3.5 ${iconColor || 'text-stone-500'}`} strokeWidth={2.2} />}
        {label}
      </div>
      <div className="text-lg font-bold text-stone-900 mt-1">
        {value}
        <span className="text-xs font-medium text-stone-600 ml-1">{unit}</span>
      </div>
    </div>
  );
}

// ホームの NutritionSummaryCard と同じレイアウト（週間平均バージョン）
function WeeklyNutritionSummary({
  avg,
  goals,
  recordedDays,
  exerciseDays,
}: {
  avg: { kcal: number; P: number; F: number; C: number };
  goals: { kcal: number; P: number; F: number; C: number };
  recordedDays: number;
  exerciseDays: number;
}) {
  const kcalPct = goals.kcal > 0 ? Math.round((avg.kcal / goals.kcal) * 100) : 0;

  const pKcal = avg.P * 4;
  const fKcal = avg.F * 9;
  const cKcal = avg.C * 4;
  const totalPfcKcal = pKcal + fKcal + cKcal;
  const pPct = totalPfcKcal > 0 ? Math.round((pKcal / totalPfcKcal) * 100) : 0;
  const fPct = totalPfcKcal > 0 ? Math.round((fKcal / totalPfcKcal) * 100) : 0;
  const cPct = totalPfcKcal > 0 ? Math.max(0, 100 - pPct - fPct) : 0;

  const nutrients = [
    { label: 'たんぱく質', value: r1(avg.P), goal: goals.P, unit: 'g', color: 'bg-rose-500' },
    { label: '脂質', value: r1(avg.F), goal: goals.F, unit: 'g', color: 'bg-amber-500' },
    { label: '炭水化物', value: r1(avg.C), goal: goals.C, unit: 'g', color: 'bg-sky-500' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-600" strokeWidth={2.2}/>
          週間平均
        </h2>
        <span className="text-[11px] text-stone-500">{kcalPct}% 達成</span>
      </div>
      <div className="text-[11px] text-stone-600 mb-3">
        <span className="inline-flex items-center gap-1"><ClipboardList className="w-3 h-3" strokeWidth={2.2}/>記録日数 {recordedDays}/7日</span>
        <span className="mx-1">・</span>
        <span className="inline-flex items-center gap-1"><Footprints className="w-3 h-3" strokeWidth={2.2}/>運動 {exerciseDays}/7日</span>
      </div>

      <div className="mb-4">
        <div className="text-xs text-stone-600 mb-1">平均カロリー（記録日のみ）</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-stone-900">{Math.round(avg.kcal)}</span>
          <span className="text-sm font-medium text-stone-500">/ {goals.kcal} kcal</span>
        </div>
        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, kcalPct) || 0}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3 mb-4">
        {nutrients.map((n) => {
          const pctRaw = n.goal > 0 ? Math.round((n.value / n.goal) * 100) : 0;
          const pct = Math.min(100, pctRaw);
          const labelStatus = pctRaw < 70 ? '不足' : pctRaw > 130 ? '過剰' : '良好';
          const labelCls =
            labelStatus === '不足'
              ? 'text-sky-700 bg-sky-100 border-sky-300'
              : labelStatus === '過剰'
              ? 'text-rose-700 bg-rose-100 border-rose-300'
              : 'text-emerald-700 bg-emerald-100 border-emerald-300';
          const LabelIcon = labelStatus === '不足' ? Lightbulb : labelStatus === '過剰' ? AlertTriangle : Sparkles;
          return (
            <div key={n.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] font-medium text-stone-700">{n.label}</span>
                <span className={`text-[9px] font-bold px-1 rounded border inline-flex items-center gap-0.5 ${labelCls}`}>
                  <LabelIcon className="w-2.5 h-2.5" strokeWidth={2.2} />
                  {labelStatus}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-sm font-bold text-stone-900">{n.value}</span>
                <span className="text-[10px] text-stone-500">/ {n.goal}{n.unit}</span>
              </div>
              <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${n.color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {totalPfcKcal > 0 && (
        <div>
          <div className="text-[11px] font-bold text-stone-700 mb-1.5">PFCバランス</div>
          <div className="flex h-5 rounded-full overflow-hidden border border-stone-200">
            <div className="bg-rose-400" style={{ width: `${pPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${fPct}%` }} />
            <div className="bg-sky-400" style={{ width: `${cPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-stone-600">
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-rose-400 rounded-sm mr-1" />
              P {pPct}%
            </span>
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-sm mr-1" />
              F {fPct}%
            </span>
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-sky-400 rounded-sm mr-1" />
              C {cPct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function fmtJp(dateString: string): string {
  // 'yyyy-MM-dd' → '5/13'
  const [, m, d] = dateString.split('-').map(Number);
  return `${m}/${d}`;
}

function fmtMd(dateString: string): string {
  return fmtJp(dateString);
}
