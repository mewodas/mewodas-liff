'use client';

import { useEffect, useState } from 'react';
import { initLiff, getLineProfile } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import PageHeader from '@/components/PageHeader';
import { Footprints, Dumbbell, Flame } from 'lucide-react';

type ExerciseLog = {
  id: string;
  date: string;
  exercise: string;
  category: string;
  durationMin: number;
  intensity: string;
  estimatedKcal: number;
  memo: string;
  createdAt: string;
};

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function monthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

const INTENSITY_COLOR: Record<string, string> = {
  軽い: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  中等度: 'text-amber-700 bg-amber-50 border-amber-200',
  激しい: 'text-rose-700 bg-rose-50 border-rose-200',
};

const CATEGORY_COLOR: Record<string, string> = {
  有酸素: 'text-sky-700 bg-sky-50 border-sky-200',
  筋トレ: 'text-orange-700 bg-orange-50 border-orange-200',
  ストレッチ: 'text-green-700 bg-green-50 border-green-200',
  その他: 'text-stone-600 bg-stone-50 border-stone-200',
};

export default function ExerciseHistoryPage() {
  const todayStr = jstTodayString();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const endDate = todayStr;
    const start = new Date(new Date(todayStr).getTime() - (days - 1) * 86400000);
    const startDate = start.toISOString().slice(0, 10);
    apiFetch(`/api/exercise-log?startDate=${startDate}&endDate=${endDate}&t=${Date.now()}`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((j) => setLogs(j.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, days, todayStr]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  const totalMin = logs.reduce((acc, l) => acc + l.durationMin, 0);
  const totalKcal = logs.reduce((acc, l) => acc + l.estimatedKcal, 0);

  // 日付でグループ化
  const byDate: Record<string, ExerciseLog[]> = {};
  for (const log of logs) {
    if (!byDate[log.date]) byDate[log.date] = [];
    byDate[log.date].push(log);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="運動履歴" Icon={Footprints} subtitle="運動記録の一覧" back />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-xl">{error}</div>
        )}

        {/* 期間セレクタ */}
        <div className="flex gap-2">
          {[14, 30, 60].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 text-xs rounded-lg font-bold border transition-colors ${
                days === d
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-stone-600 border-stone-300'
              }`}
            >
              {d}日
            </button>
          ))}
        </div>

        {/* 月間集計 */}
        {logs.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <div className="text-xs font-bold text-stone-700 mb-2">期間集計</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-2">
                <Footprints className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" strokeWidth={2} />
                <div className="text-lg font-bold text-emerald-700">{logs.length}</div>
                <div className="text-[10px] text-stone-600">回</div>
              </div>
              <div className="bg-sky-50 rounded-xl p-2">
                <Dumbbell className="w-4 h-4 text-sky-600 mx-auto mb-0.5" strokeWidth={2} />
                <div className="text-lg font-bold text-sky-700">{totalMin}</div>
                <div className="text-[10px] text-stone-600">分</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-2">
                <Flame className="w-4 h-4 text-amber-500 mx-auto mb-0.5" strokeWidth={2} />
                <div className="text-lg font-bold text-amber-600">{totalKcal}</div>
                <div className="text-[10px] text-stone-600">kcal</div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center text-stone-500 text-sm py-4">読み込み中…</div>
        )}

        {!loading && logs.length === 0 && (
          <div className="text-center text-stone-500 text-sm py-8">この期間に運動記録がありません</div>
        )}

        {/* 日付ごとの記録一覧 */}
        {sortedDates.map((date) => (
          <div key={date} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-stone-50 border-b border-stone-100">
              <span className="text-sm font-bold text-stone-700">{fmtDate(date)}</span>
            </div>
            <div className="divide-y divide-stone-50">
              {byDate[date].map((log) => (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900 text-sm">{log.exercise}</span>
                    <span className="text-amber-600 font-bold text-sm">{log.estimatedKcal} kcal</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[log.category] || CATEGORY_COLOR['その他']}`}>
                      {log.category}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${INTENSITY_COLOR[log.intensity] || ''}`}>
                      {log.intensity}
                    </span>
                    <span className="text-xs text-stone-600">{log.durationMin}分</span>
                    {log.memo && (
                      <span className="text-[10px] text-stone-500">{log.memo}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
