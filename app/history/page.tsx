'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';

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

function todayJst(): { year: number; month: number; day: number } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export default function HistoryPage() {
  const router = useRouter();
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
    setReady(false);
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
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みエラー');
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

        {/* 月ナビ */}
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
            <button
              onClick={gotoNext}
              disabled={isCurrentMonth || year > today.year || (year === today.year && month >= today.month)}
              className="px-3 py-2 text-sm bg-stone-100 rounded-xl text-stone-900 font-bold active:bg-stone-200 disabled:opacity-40"
            >
              翌月 →
            </button>
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
                  // 記録ありの日はホーム画面に遷移して詳細表示、未記録の日はその場でハイライト
                  if (cell.recorded) {
                    router.push(`/home?date=${cell.date}`);
                  } else {
                    setSelectedDate(selectedDate === cell.date ? null : cell.date);
                  }
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
          <DayDetail dateString={selectedDate} lineUserId={userId} />
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

function DayDetail({ dateString, lineUserId }: { dateString: string; lineUserId: string }) {
  const [records, setRecords] = useState<MealRecord[] | null>(null);
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
        const arr: MealRecord[] = [];
        Object.values(json.day.mealsByType as Record<string, MealRecord[]>).forEach((a) => arr.push(...a));
        setRecords(arr);
        setTotals(json.day.totals);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [dateString, lineUserId]);

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
      <h3 className="font-bold text-stone-900 mb-2">{fmtDateJp(dateString)} の詳細</h3>
      {loading && <p className="text-sm text-stone-700">読み込み中...</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}
      {!loading && !err && totals && (
        <div className="text-sm font-medium text-stone-800 mb-3 pb-2 border-b border-stone-100">
          合計 <span className="font-bold">{Math.round(totals.kcal)} kcal</span>
          <span className="text-xs text-stone-600 ml-2">
            P {r1(totals.P)}g · F {r1(totals.F)}g · C {r1(totals.C)}g
          </span>
        </div>
      )}
      {records && records.length === 0 && (
        <p className="text-sm text-stone-700">この日の食事記録はありません</p>
      )}
      {records && records.length > 0 && (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.pageId} className="text-sm border-b border-stone-100 pb-2 last:border-b-0">
              <div className="font-bold text-stone-900">
                {r.mealType} ・ {Math.round(r.kcal)} kcal
              </div>
              <div className="text-xs text-stone-700">
                P {r1(r.P)}g ・ F {r1(r.F)}g ・ C {r1(r.C)}g
              </div>
              {r.memo && <div className="text-xs text-stone-600 mt-1">{r.memo}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function fmtDateJp(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${y}/${m}/${d}（${WEEKDAYS[w]}）`;
}
