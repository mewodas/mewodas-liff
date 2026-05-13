'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached, invalidate } from '@/lib/clientCache';

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

type TodayData = {
  customer: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
    currentWeight: number | null;
    targetWeight: number | null;
    targetDate: string | null;
  };
  today: {
    date: string;
    totals: { kcal: number; P: number; F: number; C: number };
    mealsByType: Record<string, MealRecord[]>;
    recordCount: number;
    weight?: string;
    exercised?: string;
    exerciseContent?: string;
  };
  stats: {
    streakDays: number;
    bestStreakDays: number;
    last30RecordedDays: number;
    monthlyRecordedDays: number;
  } | null;
};

type SuggestData = {
  remaining: { kcal: number; P: number; F: number; C: number };
  suggestions: Array<{
    title: string;
    tag: string;
    kcal: number;
    P: number;
    F: number;
    C: number;
    reason: string;
  }>;
  message: string | null;
};

const MEAL_EMOJI: Record<string, string> = {
  朝食: '🌅',
  昼食: '☀️',
  夕食: '🌙',
  間食: '🍪',
};

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-stone-100">
          <div className="text-stone-800">読み込み中...</div>
        </main>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date');
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<SuggestData | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const todayStr = jstTodayString();
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;
  const isToday = selectedDate === todayStr;

  function navigateToDate(d: string) {
    if (d === todayStr) {
      router.push('/home');
    } else {
      router.push(`/home?date=${d}`);
    }
  }

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

  // 提案を取得（当日のみ、データ取得後）
  useEffect(() => {
    if (!userId || !data || !isToday) {
      setSuggest(null);
      return;
    }
    const cacheKey = `suggest_v1_${userId}_${selectedDate}_${Math.round(data.today.totals.kcal)}`;
    const cached = getCached<SuggestData>(cacheKey);
    if (cached) {
      setSuggest(cached.data);
      if (!cached.isStale) return;
    }
    setSuggestLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/suggest?lineUserId=${encodeURIComponent(userId)}&date=${selectedDate}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          setSuggest(null);
          return;
        }
        const json: SuggestData = await res.json();
        setSuggest(json);
        setCached(cacheKey, json);
      } catch {
        // サジェスト失敗はサイレント（メイン機能ではない）
      } finally {
        setSuggestLoading(false);
      }
    })();
  }, [userId, selectedDate, isToday, data]);

  useEffect(() => {
    if (!userId) return;
    const cacheKey = `today_v2_${userId}_${selectedDate}`;
    // キャッシュがあれば即表示（fresh/stale問わず）
    const cached = getCached<TodayData>(cacheKey);
    if (cached) {
      setData(cached.data);
      setReady(true);
      if (!cached.isStale) {
        setError(null);
        return; // freshなら再取得しない
      }
    } else {
      setReady(false);
    }
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/today?lineUserId=${encodeURIComponent(userId)}&date=${selectedDate}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `データ取得失敗（${res.status}）`);
        }
        const json = await res.json();
        setData(json);
        setCached(cacheKey, json);
      } catch (e) {
        if (!cached) setError(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setReady(true);
      }
    })();
  }, [userId, selectedDate]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl text-sm">
            {error}
          </div>
          <Link href="/record" className="block mt-4 bg-emerald-600 text-white text-center font-bold py-3 rounded-xl">
            食事記録へ
          </Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { customer, today } = data;
  const { totals, mealsByType } = today;
  const { goals } = customer;
  const dateLabel = formatJpDate(today.date);
  const goalProgress = calcGoalProgress(customer);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 pb-28">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-stone-900 mb-2">こんにちは、{customer.name} さん</h1>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 flex items-center justify-between px-2 py-2">
            <button
              onClick={() => navigateToDate(addDays(selectedDate, -1))}
              className="px-3 py-1 text-stone-900 text-lg font-bold active:bg-stone-100 rounded-lg"
              aria-label="前日"
            >
              ←
            </button>
            <div className="text-sm font-bold text-stone-900">
              {dateLabel}
              {!isToday && (
                <button
                  onClick={() => navigateToDate(todayStr)}
                  className="ml-2 text-xs text-emerald-700 font-bold"
                >
                  今日へ
                </button>
              )}
            </div>
            {!isToday ? (
              <button
                onClick={() => navigateToDate(addDays(selectedDate, 1))}
                className="px-3 py-1 text-stone-900 text-lg font-bold active:bg-stone-100 rounded-lg"
                aria-label="翌日"
              >
                →
              </button>
            ) : (
              <span className="px-3 py-1 w-[2.5rem]" />
            )}
          </div>
        </div>

        {/* 今日の摂取 */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3">📊 今日の摂取</h2>
          <ProgressRow
            label="カロリー"
            value={Math.round(totals.kcal)}
            goal={goals.kcal}
            unit="kcal"
            color="emerald"
          />
          <ProgressRow label="タンパク質" value={r1(totals.P)} goal={goals.P} unit="g" color="rose" />
          <ProgressRow label="脂質" value={r1(totals.F)} goal={goals.F} unit="g" color="amber" />
          <ProgressRow label="炭水化物" value={r1(totals.C)} goal={goals.C} unit="g" color="sky" />
        </div>

        {/* 継続バッジ（当日のみ） */}
        {isToday && data.stats && (
          <StreakCard stats={data.stats} />
        )}

        {/* 残りカロリー逆算サジェスト（当日のみ） */}
        {isToday && (
          <SuggestCard
            data={suggest}
            loading={suggestLoading}
            lineUserId={userId}
            onRecorded={() => {
              invalidate('today_');
              invalidate('weekly_');
              invalidate('history_');
              invalidate('suggest_');
              if (userId) {
                fetch(
                  `/api/today?lineUserId=${encodeURIComponent(userId)}&date=${selectedDate}&t=${Date.now()}`,
                  { cache: 'no-store' }
                )
                  .then((r) => r.json())
                  .then((json) => {
                    setData(json);
                    setCached(`today_v2_${userId}_${selectedDate}`, json);
                  })
                  .catch(() => {});
              }
            }}
          />
        )}

        {/* 体重目標 */}
        {goalProgress && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
            <h2 className="text-base font-bold text-stone-900 mb-3">🎯 体重目標進捗</h2>
            <div className="space-y-1 text-sm text-stone-800">
              <div className="flex justify-between">
                <span className="text-stone-600">現在</span>
                <span className="font-bold">{goalProgress.currentW} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">目標</span>
                <span className="font-bold">{goalProgress.targetW} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">残り</span>
                <span className="font-bold text-emerald-700">{goalProgress.remainingKg} kg</span>
              </div>
              {goalProgress.remainingWeeks !== null && (
                <>
                  <div className="flex justify-between">
                    <span className="text-stone-600">期限</span>
                    <span className="font-bold">あと {goalProgress.remainingWeeks} 週</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-stone-100">
                    <span className="text-stone-600">必要ペース</span>
                    <span className="font-bold text-emerald-700">{goalProgress.requiredPace} kg/週</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 今日の体重・運動 */}
        {(today.weight || today.exercised) && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
            <h2 className="text-base font-bold text-stone-900 mb-3">📝 今日の記録</h2>
            <div className="space-y-2 text-sm">
              {today.weight && (
                <div className="flex justify-between">
                  <span className="text-stone-700">⚖️ 体重</span>
                  <span className="font-bold text-stone-900">{today.weight} kg</span>
                </div>
              )}
              {today.exercised && (
                <div>
                  <div className="flex justify-between">
                    <span className="text-stone-700">🏃 運動</span>
                    <span className="font-bold text-stone-900">
                      {today.exercised === '✅' ? 'した' : 'なし'}
                    </span>
                  </div>
                  {today.exerciseContent && (
                    <div className="mt-1 text-xs text-stone-700 bg-stone-50 p-2 rounded-lg">
                      {today.exerciseContent}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 今日の食事 */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3">🍽️ 今日の食事</h2>
          {(['朝食', '昼食', '夕食', '間食'] as const).map((meal) => (
            <MealSection
              key={meal}
              mealType={meal}
              records={mealsByType[meal] || []}
              dayTotalKcal={totals.kcal}
              lineUserId={userId}
              onDeleted={() => {
                invalidate('today_');
                invalidate('weekly_');
                invalidate('history_');
                invalidate('suggest_');
                router.refresh();
                // 強制再取得：URLは同じだが直接フェッチ
                if (userId) {
                  fetch(
                    `/api/today?lineUserId=${encodeURIComponent(userId)}&date=${selectedDate}&t=${Date.now()}`,
                    { cache: 'no-store' }
                  )
                    .then((r) => r.json())
                    .then((json) => {
                      setData(json);
                      setCached(`today_v2_${userId}_${selectedDate}`, json);
                    })
                    .catch(() => {});
                }
              }}
            />
          ))}
        </div>

      </div>
    </main>
  );
}

function StreakCard({
  stats,
}: {
  stats: NonNullable<TodayData['stats']>;
}) {
  const { streakDays, bestStreakDays, last30RecordedDays, monthlyRecordedDays } = stats;
  // 何も記録がない場合は非表示
  if (
    streakDays === 0 &&
    bestStreakDays === 0 &&
    last30RecordedDays === 0 &&
    monthlyRecordedDays === 0
  ) {
    return null;
  }
  // バッジ獲得判定（連続記録ベースのみ）
  const badges: Array<{ icon: string; label: string; achieved: boolean }> = [
    { icon: '🥉', label: '3日連続記録', achieved: bestStreakDays >= 3 },
    { icon: '🥈', label: '7日連続記録', achieved: bestStreakDays >= 7 },
    { icon: '🥇', label: '14日連続記録', achieved: bestStreakDays >= 14 },
    { icon: '👑', label: '30日連続記録', achieved: bestStreakDays >= 30 },
  ];
  const achievedBadges = badges.filter((b) => b.achieved);

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3">🏆 継続バッジ</h2>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800">🔥 連続記録日数</div>
          <div className="text-2xl font-bold text-orange-700 mt-0.5">
            {streakDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            今、何日連続で記録中か
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800">🏆 最長連続記録</div>
          <div className="text-2xl font-bold text-amber-700 mt-0.5">
            {bestStreakDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            直近30日のベスト記録
          </div>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800">📝 今月の記録日数</div>
          <div className="text-2xl font-bold text-sky-700 mt-0.5">
            {monthlyRecordedDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            今月、食事を記録した日数
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800">📊 直近30日の記録</div>
          <div className="text-2xl font-bold text-emerald-700 mt-0.5">
            {last30RecordedDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            過去30日で記録した日数
          </div>
        </div>
      </div>
      {achievedBadges.length > 0 && (
        <div>
          <div className="text-xs font-bold text-stone-700 mb-1">獲得バッジ</div>
          <div className="flex flex-wrap gap-1.5">
            {achievedBadges.map((b) => (
              <span
                key={b.label}
                className="text-xs font-bold text-stone-900 bg-amber-100 border border-amber-300 px-2 py-1 rounded-full"
              >
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestCard({
  data,
  loading,
  lineUserId,
  onRecorded,
}: {
  data: SuggestData | null;
  loading: boolean;
  lineUserId: string | null;
  onRecorded: () => void;
}) {
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
        <h2 className="text-base font-bold text-stone-900 mb-2">💡 残り目標の食事提案</h2>
        <div className="text-sm text-stone-500 py-2">AIが提案を生成中…</div>
      </div>
    );
  }
  if (!data) return null;
  const { remaining, suggestions, message } = data;

  async function record(mealType: string) {
    if (!lineUserId || pickerFor === null) return;
    const s = suggestions[pickerFor];
    if (!s) return;
    setRecording(true);
    try {
      const res = await fetch('/api/record/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          mealType,
          title: s.title,
          kcal: s.kcal,
          P: s.P,
          F: s.F,
          C: s.C,
          day: '今日',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `記録失敗（${res.status}）`);
      }
      setPickerFor(null);
      onRecorded();
    } catch (e) {
      alert(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3">💡 残り目標の食事提案</h2>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">
        <div className="text-xs text-stone-700 mb-1">本日の残り</div>
        <div className="text-sm font-bold text-stone-900">
          {remaining.kcal} kcal
          <span className="ml-2 text-xs font-medium text-stone-700">
            P {remaining.P}g ・ F {remaining.F}g ・ C {remaining.C}g
          </span>
        </div>
      </div>
      {message && (
        <div className="text-sm text-stone-700 bg-stone-50 rounded-xl p-3">{message}</div>
      )}
      {suggestions.length > 0 && (
        <>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {s.tag}
                  </span>
                  <div className="font-bold text-sm text-stone-900 leading-tight">
                    {s.title}
                  </div>
                </div>
                <div className="text-xs font-medium text-stone-700 ml-1">
                  約 {s.kcal} kcal ・ P 約{s.P}g ・ F 約{s.F}g ・ C 約{s.C}g
                </div>
                {s.reason && (
                  <div className="text-[11px] text-stone-500 mt-0.5 ml-1 mb-2">💬 {s.reason}</div>
                )}
                <button
                  onClick={() => setPickerFor(i)}
                  className="mt-1 w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg active:bg-emerald-700"
                >
                  🍽️ これ食べた
                </button>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-stone-500 mt-3 leading-relaxed">
            ※ 数値はAIによる推定値です。実際に食べた料理を写真で記録すると、その内容から計算された正確な数値が反映されます。
          </div>
        </>
      )}

      {/* 食事区分ピッカーモーダル */}
      {pickerFor !== null && suggestions[pickerFor] && (
        <div
          className="fixed inset-0 bg-black/40 z-[70] flex items-end"
          onClick={() => !recording && setPickerFor(null)}
        >
          <div
            className="bg-white rounded-t-2xl shadow-2xl p-5 pb-8 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-bold text-stone-900 mb-2 text-center">
              食事区分を選んでください
            </h3>
            <div className="text-xs text-stone-600 mb-4 text-center leading-tight">
              {suggestions[pickerFor].title}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['朝食', '昼食', '夕食', '間食'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => record(m)}
                  disabled={recording}
                  className="bg-stone-100 text-stone-900 font-bold py-4 rounded-xl active:bg-stone-200 disabled:opacity-50"
                >
                  {m === '朝食' ? '🌅' : m === '昼食' ? '☀️' : m === '夕食' ? '🌙' : '🍪'} {m}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPickerFor(null)}
              disabled={recording}
              className="w-full mt-4 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl active:bg-stone-200 disabled:opacity-50"
            >
              {recording ? '記録中…' : 'キャンセル'}
            </button>
          </div>
        </div>
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
        <div
          className={`h-full ${barColor[color]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MealSection({
  mealType,
  records,
  dayTotalKcal,
  lineUserId,
  onDeleted,
}: {
  mealType: string;
  records: MealRecord[];
  dayTotalKcal: number;
  lineUserId: string | null;
  onDeleted: () => void;
}) {
  const emoji = MEAL_EMOJI[mealType] || '🍽️';
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(pageId: string) {
    if (!lineUserId) return;
    if (!confirm('この記録を削除します。よろしいですか？')) return;
    setDeletingId(pageId);
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, lineUserId }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `削除失敗（${res.status}）`);
      }
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除エラー');
    } finally {
      setDeletingId(null);
    }
  }
  const totals = records.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      P: acc.P + r.P,
      F: acc.F + r.F,
      C: acc.C + r.C,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );
  const pctOfDay =
    dayTotalKcal > 0 ? Math.round((totals.kcal / dayTotalKcal) * 100) : 0;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-stone-900">
          {emoji} {mealType}
        </span>
        <span className="text-sm font-bold text-stone-900">
          {records.length === 0 ? (
            <span className="text-stone-500 font-medium">未記録</span>
          ) : (
            <>
              {Math.round(totals.kcal)} kcal
              <span className="text-xs font-medium text-stone-500 ml-1">
                （{pctOfDay}%）
              </span>
            </>
          )}
        </span>
      </div>
      {records.length > 0 && (
        <div className="mb-2 text-xs font-medium text-stone-700">
          P {r1(totals.P)}g ・ F {r1(totals.F)}g ・ C {r1(totals.C)}g
          {records.length > 1 && (
            <span className="text-stone-500 ml-2">（{records.length}回記録）</span>
          )}
        </div>
      )}
      {records.length > 0 && (
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
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-stone-100"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-stone-700">
                    {Math.round(r.kcal)} kcal · P{r1(r.P)} F{r1(r.F)} C{r1(r.C)}
                  </div>
                  {r.memo && (
                    <div className="text-xs text-stone-600 mt-1 line-clamp-2">{r.memo}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(r.pageId)}
                  disabled={deletingId === r.pageId}
                  className="flex-shrink-0 text-xs text-red-700 font-bold px-2 py-1 rounded-lg active:bg-red-50 disabled:opacity-50"
                  aria-label="記録を削除"
                >
                  {deletingId === r.pageId ? '削除中…' : '🗑️'}
                </button>
              </div>
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

// Google Drive の "view" URL を画像直接表示可能なサムネイルURLに変換
// 例：https://drive.google.com/file/d/ABC/view → https://drive.google.com/thumbnail?id=ABC&sz=w400
function toDriveThumbnailUrl(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return url;
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
}

function formatJpDate(dateString: string): string {
  // 'yyyy-MM-dd' → '2026/05/13（火）'
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${dayNames[date.getDay()]}）`;
}

function calcGoalProgress(customer: TodayData['customer']) {
  const currentW = customer.currentWeight;
  const targetW = customer.targetWeight;
  if (!currentW || !targetW) return null;
  const remainingKg = Math.max(0, r1(currentW - targetW));
  let remainingWeeks: number | null = null;
  let requiredPace: number | null = null;
  if (customer.targetDate) {
    const today = new Date();
    const td = new Date(customer.targetDate);
    const daysLeft = Math.ceil((td.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0) {
      remainingWeeks = Math.max(1, Math.ceil(daysLeft / 7));
      requiredPace = r1(remainingKg / remainingWeeks);
    }
  }
  return { currentW, targetW, remainingKg, remainingWeeks, requiredPace };
}
