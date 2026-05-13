'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached } from '@/lib/clientCache';
import FooterNav from '@/components/FooterNav';

type Stats = {
  streakDays: number;
  bestStreakDays: number;
  last30RecordedDays: number;
  monthlyRecordedDays: number;
};

type TodayData = {
  stats: Stats | null;
};

export default function BadgesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const userId = profile.userId;
        const today = jstToday();
        const cacheKey = `today_v2_${userId}_${today}`;
        const cached = getCached<TodayData>(cacheKey);
        if (cached) {
          setStats(cached.data.stats);
          setReady(true);
          if (!cached.isStale) return;
        }
        const res = await fetch(
          `/api/today?lineUserId=${encodeURIComponent(userId)}&date=${today}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const json: TodayData = await res.json();
        setStats(json.stats);
        setCached(cacheKey, json);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-24">
      <header className="bg-white border-b border-stone-200 px-4 pt-5 pb-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-stone-700 text-sm font-medium"
            type="button"
          >
            ← 戻る
          </button>
          <h1 className="text-base font-bold text-stone-900">🏆 バッジ獲得</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-4 py-5">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl">
            {error}
          </div>
        )}
        {!error && stats && <StreakCard stats={stats} />}
        {!error && (!stats || allZero(stats)) && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-sm font-bold text-stone-800 mb-1">まだバッジはありません</div>
            <div className="text-xs text-stone-600 leading-relaxed">
              食事を記録して連続記録を伸ばすと、バッジが獲得できます。
            </div>
          </div>
        )}
      </div>

      <FooterNav />
    </main>
  );
}

function allZero(s: Stats): boolean {
  return s.streakDays === 0 && s.bestStreakDays === 0 && s.last30RecordedDays === 0 && s.monthlyRecordedDays === 0;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function StreakCard({ stats }: { stats: Stats }) {
  const { streakDays, bestStreakDays, last30RecordedDays, monthlyRecordedDays } = stats;
  const badges: Array<{ icon: string; label: string; threshold: number }> = [
    { icon: '🥉', label: '3日連続記録', threshold: 3 },
    { icon: '🥈', label: '7日連続記録', threshold: 7 },
    { icon: '🥇', label: '14日連続記録', threshold: 14 },
    { icon: '👑', label: '30日連続記録', threshold: 30 },
  ];
  const achieved = badges.filter((b) => bestStreakDays >= b.threshold);
  const upcoming = badges.find((b) => bestStreakDays < b.threshold);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
        <h2 className="text-base font-bold text-stone-900 mb-3">📊 連続記録</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-3">
            <div className="text-xs font-bold text-stone-800">🔥 連続記録</div>
            <div className="text-2xl font-bold text-orange-700 mt-0.5">
              {streakDays}
              <span className="text-xs font-medium text-stone-600 ml-1">日</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
              今、何日連続で記録中か
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
            <div className="text-xs font-bold text-stone-800">🏆 最長連続</div>
            <div className="text-2xl font-bold text-amber-700 mt-0.5">
              {bestStreakDays}
              <span className="text-xs font-medium text-stone-600 ml-1">日</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
              直近30日のベスト記録
            </div>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-3">
            <div className="text-xs font-bold text-stone-800">📝 今月の記録日数</div>
            <div className="text-2xl font-bold text-sky-700 mt-0.5">
              {monthlyRecordedDays}
              <span className="text-xs font-medium text-stone-600 ml-1">日</span>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3">
            <div className="text-xs font-bold text-stone-800">📊 直近30日</div>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">
              {last30RecordedDays}
              <span className="text-xs font-medium text-stone-600 ml-1">日</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
        <h2 className="text-base font-bold text-stone-900 mb-3">🎖 獲得バッジ</h2>
        {achieved.length === 0 ? (
          <div className="text-sm text-stone-600">
            まだ獲得していません。連続記録を伸ばすとバッジが手に入ります。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {achieved.map((b) => (
              <span
                key={b.label}
                className="text-sm font-bold text-stone-900 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-full"
              >
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        )}
        {upcoming && (
          <div className="mt-2 bg-stone-50 rounded-xl p-3 border border-stone-200">
            <div className="text-xs font-bold text-stone-700 mb-1">🎯 次のバッジ</div>
            <div className="text-sm font-bold text-stone-900">
              {upcoming.icon} {upcoming.label}
            </div>
            <div className="text-xs text-stone-600 mt-1">
              あと <span className="font-bold text-emerald-700">{upcoming.threshold - bestStreakDays}日</span> 連続で記録すれば獲得！
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="text-xs font-bold text-amber-800 mb-1">💡 続けるコツ</div>
        <ul className="text-xs text-stone-800 space-y-1 leading-relaxed">
          <li>・寝る前にその日の食事を振り返って記録</li>
          <li>・少なくとも1食記録すれば連続日数は途切れない</li>
          <li>・「食べなかった」も記録としてカウント</li>
        </ul>
      </div>
    </div>
  );
}
