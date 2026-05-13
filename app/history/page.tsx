'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached } from '@/lib/clientCache';

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

const MEAL_EMOJI: Record<string, string> = {
  朝食: '🌅',
  昼食: '☀️',
  夕食: '🌙',
  間食: '🍪',
};

function todayJst(): { year: number; month: number; day: number } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export default function HistoryPage() {
  const today = todayJst();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
    const cacheKey = `history_${userId}_${year}_${month}`;
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
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDate(null);
  }

  function gotoNext() {
    if (year > today.year || (year === today.year && month >= today.month)) return;
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDate(null);
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
          <Link href="/home" className="block bg-emerald-600 text-white text-center font-bold py-3 rounded-xl">
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
    <main className="min-h-screen bg-stone-100 px-4 py-6 pb-28">
      <div className="max-w-md mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-stone-900">📅 履歴</h1>
        </div>

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
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-around text-xs text-stone-700">
            <span>✨ ±5%</span>
            <span>⭕ ±15%</span>
            <span>🔺 ±25%</span>
            <span>💦 それ以上</span>
          </div>
        </div>

        {/* 選択日の詳細 */}
        {selectedDate && userId && (
          <DayDetail dateString={selectedDate} lineUserId={userId} goals={customer.goals} />
        )}
      </div>
    </main>
  );
}

function statusEmoji(kcal: number, goal: number): string {
  if (kcal === 0) return '';
  const pct = (kcal / goal) * 100;
  const diff = Math.abs(pct - 100);
  if (diff <= 5) return '✨';
  if (diff <= 15) return '⭕';
  if (diff <= 25) return '🔺';
  return '💦';
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
  const status = cell.recorded ? statusEmoji(cell.kcal, goalKcal) : '';
  const weekdayColor =
    cell.weekday === 0 ? 'text-rose-700' : cell.weekday === 6 ? 'text-sky-700' : 'text-stone-900';
  return (
    <button
      onClick={onClick}
      className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors ${
        isSelected
          ? 'bg-emerald-100 border-2 border-emerald-500'
          : isToday
          ? 'bg-emerald-50 border border-emerald-300'
          : cell.recorded
          ? 'bg-stone-50 active:bg-stone-100'
          : 'active:bg-stone-100'
      }`}
    >
      <span className={`font-bold ${weekdayColor}`}>{cell.day}</span>
      <span className="text-base leading-none mt-0.5">{status || (cell.recorded ? '' : '·')}</span>
    </button>
  );
}

function DayDetail({
  dateString,
  lineUserId,
  goals,
}: {
  dateString: string;
  lineUserId: string;
  goals: { kcal: number; P: number; F: number; C: number };
}) {
  const [mealsByType, setMealsByType] = useState<Record<string, MealRecord[]> | null>(null);
  const [totals, setTotals] = useState<{ kcal: number; P: number; F: number; C: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
      } catch (e) {
        setErr(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [dateString, lineUserId]);

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
          {/* 摂取サマリ */}
          <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
            <h4 className="text-base font-bold text-stone-900 mb-3">📊 摂取</h4>
            <ProgressRow label="カロリー" value={Math.round(totals.kcal)} goal={goals.kcal} unit="kcal" color="emerald" />
            <ProgressRow label="タンパク質" value={r1(totals.P)} goal={goals.P} unit="g" color="rose" />
            <ProgressRow label="脂質" value={r1(totals.F)} goal={goals.F} unit="g" color="amber" />
            <ProgressRow label="炭水化物" value={r1(totals.C)} goal={goals.C} unit="g" color="sky" />
          </div>

          {/* 食事リスト */}
          {mealsByType && Object.values(mealsByType).some((arr) => arr.length > 0) && (
            <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
              <h4 className="text-base font-bold text-stone-900 mb-3">🍽️ 食事</h4>
              {(['朝食', '昼食', '夕食', '間食'] as const).map((meal) => {
                const records = mealsByType[meal] || [];
                if (records.length === 0) return null;
                const mealTotal = records.reduce(
                  (acc, r) => ({ kcal: acc.kcal + r.kcal, P: acc.P + r.P, F: acc.F + r.F, C: acc.C + r.C }),
                  { kcal: 0, P: 0, F: 0, C: 0 }
                );
                return (
                  <div key={meal} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-stone-900">
                        {MEAL_EMOJI[meal]} {meal}
                      </span>
                      <span className="text-sm font-bold text-stone-900">{Math.round(mealTotal.kcal)} kcal</span>
                    </div>
                    <div className="text-xs font-medium text-stone-700 mb-2">
                      P {r1(mealTotal.P)}g ・ F {r1(mealTotal.F)}g ・ C {r1(mealTotal.C)}g
                    </div>
                    <div className="space-y-2">
                      {records.map((r) => (
                        <div key={r.pageId} className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                          <div className="flex items-start gap-3">
                            {r.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={toDriveThumbnailUrl(r.imageUrl)}
                                alt={r.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-stone-100"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-stone-700">
                                {Math.round(r.kcal)} kcal · P{r1(r.P)} F{r1(r.F)} C{r1(r.C)}
                              </div>
                              {r.memo && <div className="text-xs text-stone-600 mt-1 line-clamp-2">{r.memo}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const status = pct >= 95 && pct <= 105 ? '✨' : pct >= 80 && pct <= 120 ? '⭕' : pct >= 60 ? '🔺' : '💦';
  const barColor: Record<string, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
  };
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-stone-800">
          {label} {status}
        </span>
        <span className="font-bold text-stone-900">
          {value} / {goal} {unit}
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
