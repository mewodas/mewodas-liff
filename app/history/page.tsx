'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached, invalidate } from '@/lib/clientCache';
import PageHeader from '@/components/PageHeader';
import WeightExerciseCard from '@/components/WeightExerciseCard';
import MealRatioChart from '@/components/MealRatioChart';
import {
  BookOpen,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  UtensilsCrossed,
  BarChart3,
  ClipboardList,
  Footprints,
  Scale,
  Sparkles,
  Circle,
  Triangle,
  Droplets,
  Ban,
  Lightbulb,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

type DailyAgg = {
  day: number;
  date: string;
  weekday: number;
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
  exercised: boolean;
  weight: string;
};

type HistoryData = {
  customer: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
  };
  month: {
    year: number;
    month: number;
    daysInMonth: number;
    firstWeekday: number;
    daily: DailyAgg[];
    mealRatio?: Record<string, number>;
  };
};

type MealRecord = {
  pageId: string;
  mealType: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  memo: string;
  imageUrl: string | null;
  title: string;
  recordedAt: string;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const MEAL_ICON: Record<string, LucideIcon> = {
  朝食: Sunrise,
  昼食: Sun,
  夕食: Moon,
  間食: Cookie,
};
const MEAL_COLOR: Record<string, string> = {
  朝食: 'text-orange-500',
  昼食: 'text-amber-500',
  夕食: 'text-indigo-500',
  間食: 'text-pink-500',
};

function todayJst(): { year: number; month: number; day: number } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function HistoryPage() {
  const today = todayJst();
  const todayStr = `${today.year}-${pad2(today.month)}-${pad2(today.day)}`;
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // 初期値：当日を選択しておく（クリックなしで詳細が見える）
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

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
    const cacheKey = `history_v2_${userId}_${year}_${month}`;
    const cached = getCached<HistoryData>(cacheKey);
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
        const res = await fetch(
          `/api/history?lineUserId=${encodeURIComponent(userId)}&year=${year}&month=${month}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
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
  }, [userId, year, month]);

  function gotoPrev() {
    let newY = year;
    let newM = month;
    if (month === 1) {
      newY = year - 1;
      newM = 12;
    } else {
      newM = month - 1;
    }
    setYear(newY);
    setMonth(newM);
    // 月の最終日を選択（直近の日付）
    const lastDay = new Date(newY, newM, 0).getDate();
    setSelectedDate(`${newY}-${pad2(newM)}-${pad2(lastDay)}`);
  }

  function gotoNext() {
    if (year > today.year || (year === today.year && month >= today.month)) return;
    let newY = year;
    let newM = month;
    if (month === 12) {
      newY = year + 1;
      newM = 1;
    } else {
      newM = month + 1;
    }
    setYear(newY);
    setMonth(newM);
    // 当月なら今日、過去月なら月末を選択
    if (newY === today.year && newM === today.month) {
      setSelectedDate(todayStr);
    } else {
      const lastDay = new Date(newY, newM, 0).getDate();
      setSelectedDate(`${newY}-${pad2(newM)}-${pad2(lastDay)}`);
    }
  }

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

  const { customer, month: m } = data;
  const isCurrentMonth = year === today.year && month === today.month;
  // 6週分の日付配列（前月末・翌月初の空セル含む）
  const cells: Array<DailyAgg | null> = [];
  for (let i = 0; i < m.firstWeekday; i++) cells.push(null);
  for (const d of m.daily) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="履歴" Icon={BookOpen} subtitle="過去の記録をカレンダーで確認" back />
      <div className="max-w-md mx-auto px-4 py-6">
        {/* 月ナビ（過去のみ） */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200">
          <div className="flex items-center justify-between">
            <button
              onClick={gotoPrev}
              className="px-3 py-2 text-sm bg-stone-100 rounded-xl text-stone-900 font-bold active:bg-stone-200"
            >
              ← 前月
            </button>
            <div className="font-bold text-stone-900">
              {year}年 {month}月
            </div>
            {!isCurrentMonth ? (
              <button
                onClick={gotoNext}
                className="px-3 py-2 text-sm bg-stone-100 rounded-xl text-stone-900 font-bold active:bg-stone-200"
              >
                翌月 →
              </button>
            ) : (
              <span className="px-3 py-2 w-[5.5rem]" />
            )}
          </div>
        </div>

        {/* 月次サマリ */}
        <MonthlySummary daily={m.daily} isCurrentMonth={isCurrentMonth} todayDay={today.day} />

        {/* 食事ごとの割合（円グラフ） */}
        {m.mealRatio && (
          <MealRatioChart mealRatio={m.mealRatio} title="今月の食事割合" />
        )}

        {/* カレンダー */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={
                  i === 0 ? 'text-rose-700' : i === 6 ? 'text-sky-700' : 'text-stone-700'
                }
              >
                {w}
              </div>
            ))}
          </div>
          {/* 日付グリッド */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => (
              <CalendarCell
                key={idx}
                cell={cell}
                goalKcal={customer.goals.kcal}
                isToday={
                  cell !== null &&
                  cell.day === today.day &&
                  month === today.month &&
                  year === today.year
                }
                isSelected={cell !== null && selectedDate === cell.date}
                onClick={() => {
                  if (!cell) return;
                  setSelectedDate(selectedDate === cell.date ? null : cell.date);
                }}
              />
            ))}
          </div>

          {/* 凡例 */}
          <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-stone-700">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.2} />
              完璧（±5%）
            </span>
            <span className="inline-flex items-center gap-1">
              <Circle className="w-3.5 h-3.5 text-sky-500" strokeWidth={2.2} />
              良好（±15%）
            </span>
            <span className="inline-flex items-center gap-1">
              <Triangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.2} />
              もう少し（±25%）
            </span>
            <span className="inline-flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-rose-500" strokeWidth={2.2} />
              頑張りましょう
            </span>
          </div>
        </div>

        {/* 選択日の詳細 */}
        {selectedDate && userId && (
          <DayDetail
            dateString={selectedDate}
            lineUserId={userId}
            goals={customer.goals}
            todayStr={todayStr}
          />
        )}
      </div>
    </main>
  );
}

function MonthlySummary({
  daily,
  isCurrentMonth,
  todayDay,
}: {
  daily: DailyAgg[];
  isCurrentMonth: boolean;
  todayDay: number;
}) {
  // 当月なら今日まで、過去月なら全日でカウント
  const effectiveDays = isCurrentMonth ? daily.filter((d) => d.day <= todayDay) : daily;
  const recorded = effectiveDays.filter((d) => d.recorded);
  const exerciseDays = effectiveDays.filter((d) => d.exercised).length;
  const avgKcal =
    recorded.length > 0
      ? Math.round(recorded.reduce((sum, d) => sum + d.kcal, 0) / recorded.length)
      : 0;

  // 体重の増減（最初の記録日と最新の記録日の差分）
  const weightDays = effectiveDays.filter((d) => d.weight && !isNaN(parseFloat(d.weight)));
  const firstWeight = weightDays.length > 0 ? parseFloat(weightDays[0].weight) : null;
  const lastWeight =
    weightDays.length > 0 ? parseFloat(weightDays[weightDays.length - 1].weight) : null;
  const weightDelta =
    firstWeight !== null && lastWeight !== null
      ? Math.round((lastWeight - firstWeight) * 10) / 10
      : null;
  const weightSign = weightDelta === null ? '' : weightDelta > 0 ? '+' : '';
  const weightDisplay = weightDelta === null ? '—' : `${weightSign}${weightDelta}`;

  const totalDaysToShow = effectiveDays.length;
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <BarChart3 className="w-4 h-4 text-stone-700" strokeWidth={2.2} />
        月次サマリ
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <StatBox
          Icon={ClipboardList}
          iconColor="text-sky-600"
          label="食事を記録した日数"
          value={`${recorded.length}/${totalDaysToShow}`}
          unit="日"
        />
        <StatBox
          Icon={Footprints}
          iconColor="text-amber-600"
          label="運動した日数"
          value={`${exerciseDays}/${totalDaysToShow}`}
          unit="日"
        />
        <StatBox
          Icon={Scale}
          iconColor="text-sky-600"
          label="体重の増減"
          value={weightDisplay}
          unit={weightDelta !== null ? 'kg' : ''}
        />
        <StatBox
          Icon={BarChart3}
          iconColor="text-emerald-600"
          label="1日あたり平均"
          value={avgKcal > 0 ? `${avgKcal}` : '—'}
          unit={avgKcal > 0 ? 'kcal' : ''}
        />
      </div>
      {weightDelta !== null && weightDays.length >= 2 && (
        <p className="text-[10px] text-stone-500 mt-2 leading-relaxed flex items-center gap-1">
          <Scale className="w-3 h-3" strokeWidth={2.2} />
          {firstWeight}kg（最初の記録）→ {lastWeight}kg（最新）／{weightDays.length}回測定
        </p>
      )}
    </div>
  );
}

function StatBox({
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

function statusInfo(kcal: number, goal: number): { Icon: LucideIcon; color: string } | null {
  if (kcal === 0 || goal === 0) return null;
  const pct = (kcal / goal) * 100;
  const diff = Math.abs(pct - 100);
  if (diff <= 5) return { Icon: Sparkles, color: 'text-emerald-500' };
  if (diff <= 15) return { Icon: Circle, color: 'text-sky-500' };
  if (diff <= 25) return { Icon: Triangle, color: 'text-amber-500' };
  return { Icon: Droplets, color: 'text-rose-500' };
}

function CalendarCell({
  cell,
  goalKcal,
  isToday,
  isSelected,
  onClick,
}: {
  cell: DailyAgg | null;
  goalKcal: number;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!cell) {
    return <div className="aspect-square" />;
  }
  const status = cell.recorded ? statusInfo(cell.kcal, goalKcal) : null;
  const weekdayColor =
    cell.weekday === 0 ? 'text-rose-700' : cell.weekday === 6 ? 'text-sky-700' : 'text-stone-900';
  return (
    <button
      onClick={onClick}
      className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative ${
        isSelected
          ? 'bg-emerald-100 border-2 border-emerald-500'
          : isToday
          ? 'bg-emerald-50 border border-emerald-300'
          : cell.exercised
          ? 'bg-amber-50 border border-amber-300 active:bg-amber-100'
          : cell.recorded
          ? 'bg-stone-50 active:bg-stone-100'
          : 'active:bg-stone-100'
      }`}
    >
      <span className={`font-bold ${weekdayColor}`}>{cell.day}</span>
      <div className="flex items-center gap-0.5 mt-0.5">
        {status ? (
          <status.Icon className={`w-3.5 h-3.5 ${status.color}`} strokeWidth={2.2} />
        ) : (
          <span className="text-stone-400">{cell.recorded ? '' : '·'}</span>
        )}
        {cell.exercised && (
          <Footprints className="w-3 h-3 text-amber-600" strokeWidth={2.2} aria-label="運動日" />
        )}
      </div>
    </button>
  );
}

function DayDetail({
  dateString,
  lineUserId,
  goals,
  todayStr,
}: {
  dateString: string;
  lineUserId: string;
  goals: { kcal: number; P: number; F: number; C: number };
  todayStr: string;
}) {
  const [mealsByType, setMealsByType] = useState<Record<string, MealRecord[]> | null>(null);
  const [totals, setTotals] = useState<{ kcal: number; P: number; F: number; C: number } | null>(null);
  const [dayExtras, setDayExtras] = useState<{ weight: string; exercised: string; exerciseContent: string }>({
    weight: '',
    exercised: '',
    exerciseContent: '',
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/day?lineUserId=${encodeURIComponent(lineUserId)}&date=${dateString}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const json = await res.json();
        setMealsByType(json.day.mealsByType);
        setTotals(json.day.totals);
        setDayExtras({
          weight: json.day.weight || '',
          exercised: json.day.exercised || '',
          exerciseContent: json.day.exerciseContent || '',
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [dateString, lineUserId, reloadKey]);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-stone-900 text-lg">{fmtDateJp(dateString)}</h3>
      {loading && (
        <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200 text-sm text-stone-700">
          読み込み中...
        </div>
      )}
      {err && (
        <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl text-sm">{err}</div>
      )}
      {!loading && !err && totals && (
        <>
          {/* 体重・運動カード（ホームと同じUI） */}
          <WeightExerciseCard
            selectedDate={dateString}
            isToday={dateString === todayStr}
            lineUserId={lineUserId}
            initialWeight={dayExtras.weight}
            initialExercised={dayExtras.exercised}
            initialExerciseContent={dayExtras.exerciseContent}
            onUpdated={() => {
              invalidate('today_');
              invalidate('weekly_');
              invalidate('history_');
              setReloadKey((k) => k + 1);
            }}
          />

          {/* 摂取サマリ */}
          <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
            <h4 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-stone-700" strokeWidth={2.2} />
              摂取
            </h4>
            <ProgressRow label="カロリー" value={Math.round(totals.kcal)} goal={goals.kcal} unit="kcal" color="emerald" />
            <ProgressRow label="タンパク質" value={r1(totals.P)} goal={goals.P} unit="g" color="rose" />
            <ProgressRow label="脂質" value={r1(totals.F)} goal={goals.F} unit="g" color="amber" />
            <ProgressRow label="炭水化物" value={r1(totals.C)} goal={goals.C} unit="g" color="sky" />
          </div>

          {/* 食事リスト（ホームと同じレイアウト） */}
          {mealsByType && Object.values(mealsByType).some((arr) => arr.length > 0) && (
            <div className="space-y-3">
              {(['朝食', '昼食', '夕食', '間食'] as const).map((meal) => {
                const records = mealsByType[meal] || [];
                const dayKcal = Object.values(mealsByType).flat().reduce((s, r) => s + r.kcal, 0);
                return (
                  <HistoryMealSection
                    key={meal}
                    mealType={meal}
                    records={records}
                    dayTotalKcal={dayKcal}
                    selectedDate={dateString}
                  />
                );
              })}
            </div>
          )}
          {mealsByType && Object.values(mealsByType).every((arr) => arr.length === 0) && (
            <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200 text-sm text-stone-700">
              この日の食事記録はありません
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HistoryMealSection({
  mealType,
  records,
  dayTotalKcal,
  selectedDate,
}: {
  mealType: string;
  records: MealRecord[];
  dayTotalKcal: number;
  selectedDate: string;
}) {
  const MealIcon = MEAL_ICON[mealType] || UtensilsCrossed;
  const mealIconColor = MEAL_COLOR[mealType] || 'text-stone-600';
  const totals = records.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      P: acc.P + r.P,
      F: acc.F + r.F,
      C: acc.C + r.C,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );
  const pctOfDay = dayTotalKcal > 0 ? Math.round((totals.kcal / dayTotalKcal) * 100) : 0;
  const hasRecords = records.length > 0;
  const detailHref = `/meal-detail?date=${selectedDate}&meal=${encodeURIComponent(mealType)}`;
  const recordHref = `/record?meal=${encodeURIComponent(mealType)}`;
  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <Link
        href={hasRecords ? detailHref : recordHref}
        className="block px-4 py-3 active:bg-stone-50"
      >
        <div className="flex justify-between items-center">
          <span className="font-bold text-stone-900 flex items-center gap-1.5">
            <MealIcon className={`w-4 h-4 ${mealIconColor}`} strokeWidth={2.2} />
            {mealType}
          </span>
          <span className="text-sm font-bold text-stone-900">
            {hasRecords ? (
              <>
                {Math.round(totals.kcal)} kcal
                <span className="text-xs font-medium text-stone-500 ml-1">
                  （{pctOfDay}%）
                </span>
              </>
            ) : (
              <span className="text-stone-500 font-medium text-xs">未記録</span>
            )}
          </span>
        </div>
        {hasRecords && (
          <div className="mt-1 text-[11px] font-medium text-stone-700">
            P {r1(totals.P)}g ・ F {r1(totals.F)}g ・ C {r1(totals.C)}g
          </div>
        )}
      </Link>
      {hasRecords && (
        <>
          <Link href={detailHref} className="block border-t border-stone-100 active:bg-stone-50">
            <div className="divide-y divide-stone-100">
              {records.map((r) => {
                const isSkipped = r.memo === '食べなかった' || r.title === '食べなかった';
                const name = histShortName(r);
                const unit = histUnitFromName(name);
                return (
                  <div key={r.pageId} className="flex items-center px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-stone-900 truncate">
                        {isSkipped ? '🚫 食べなかった' : name}
                      </div>
                      <div className="text-[10px] text-stone-600 mt-0.5">
                        {Math.round(r.kcal)} kcal
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 text-[11px] font-medium text-stone-700 border border-stone-300 px-2 py-0.5 rounded-full">
                      {unit}
                    </div>
                  </div>
                );
              })}
            </div>
          </Link>
          {records.some((r) => r.imageUrl) && (
            <Link
              href={detailHref}
              className="block border-t border-stone-100 px-4 py-3 active:bg-stone-50 overflow-x-auto scrollbar-hide"
            >
              <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                {records
                  .filter((r) => r.imageUrl)
                  .map((r) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={r.pageId}
                      src={toDriveThumbnailUrl(r.imageUrl!)}
                      alt={r.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-20 h-20 object-cover rounded-xl bg-stone-100 flex-shrink-0"
                    />
                  ))}
              </div>
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function histShortName(r: MealRecord): string {
  const memo = (r.memo || '').trim();
  if (!memo) return r.title || '食事';
  const beforeAi = memo.split(/\s*\/\s*AI識別[:：]/)[0] || memo;
  const firstItem = beforeAi.split(/[、,]/)[0]?.trim();
  return firstItem || beforeAi.slice(0, 30);
}

function histUnitFromName(name: string): string {
  const m = name.match(/\s+([0-9０-９.]+\s*(g|ml|個|本|杯|皿|枚|切れ|人前|匹|玉|串|缶|袋|箱|食|kg))$/);
  if (m) return m[1].trim();
  const m2 = name.match(/[（(]([^）)]+)[）)]\s*$/);
  if (m2 && /[0-9０-９]/.test(m2[1])) return m2[1].trim();
  return '1人前';
}

function ProgressRow({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: 'emerald' | 'rose' | 'amber' | 'sky';
}) {
  const pctRaw = goal > 0 ? Math.round((value / goal) * 100) : 0;
  const pct = Math.min(100, pctRaw);
  // ホームと同じ「不足／良好／過剰」基準（70%未満で不足、130%超で過剰）
  const labelStatus = pctRaw < 70 ? '不足' : pctRaw > 130 ? '過剰' : '良好';
  const statusBadge =
    labelStatus === '不足'
      ? { Icon: Lightbulb, text: '不足', cls: 'text-sky-700 bg-sky-100 border-sky-300' }
      : labelStatus === '過剰'
      ? { Icon: AlertTriangle, text: '過剰', cls: 'text-rose-700 bg-rose-100 border-rose-300' }
      : { Icon: Sparkles, text: '良好', cls: 'text-emerald-700 bg-emerald-100 border-emerald-300' };
  const barColor: Record<string, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
  };
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center text-sm mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-800">{label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-0.5 ${statusBadge.cls}`}>
            <statusBadge.Icon className="w-3 h-3" strokeWidth={2.2} />
            {statusBadge.text}
          </span>
        </div>
        <span className="font-bold text-stone-900">
          {value} / {goal} {unit}
          <span className="text-xs font-medium text-stone-500 ml-1">（{pctRaw}%）</span>
        </span>
      </div>
      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor[color]} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Drive URLをサムネイル化
function toDriveThumbnailUrl(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return url;
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
}

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function fmtDateJp(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${y}/${m}/${d}（${WEEKDAYS[w]}）`;
}
