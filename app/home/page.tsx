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
  details?: {
    fiber: number;
    salt: number;
    iron: number;
    calcium: number;
    vitaminC: number;
  } | null;
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

type PredictionData = {
  prediction: {
    predictedWeight: number;
    monthlyChange: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    willReachGoal: boolean | null;
    comment: string;
    recommendations: string[];
  } | null;
  reason?: string;
  message?: string;
  dataPoints: {
    recordedDays: number;
    weightDays: number;
    exerciseDays: number;
  };
};

const MEAL_EMOJI: Record<string, string> = {
  朝食: '🌅',
  昼食: '☀️',
  夕食: '🌙',
  間食: '🍪',
};

function greetingByHour(): string {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours();
  if (h < 5) return 'こんばんは';
  if (h < 11) return 'おはようございます';
  if (h < 17) return 'こんにちは';
  return 'こんばんは';
}

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
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);

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

  // 体重予測を取得（当日のみ、データ取得後、長めのキャッシュ）
  useEffect(() => {
    if (!userId || !data || !isToday) {
      setPrediction(null);
      return;
    }
    const cacheKey = `predict_v1_${userId}_${selectedDate}`;
    const cached = getCached<PredictionData>(cacheKey);
    if (cached) {
      setPrediction(cached.data);
      if (!cached.isStale) return;
    }
    setPredictionLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/predict-weight?lineUserId=${encodeURIComponent(userId)}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          setPrediction(null);
          return;
        }
        const json: PredictionData = await res.json();
        setPrediction(json);
        setCached(cacheKey, json);
      } catch {
        // 予測失敗はサイレント
      } finally {
        setPredictionLoading(false);
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
        {/* ヘッダー：挨拶＋バッジ＋カレンダー */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-stone-900 truncate">
              {greetingByHour()}、{customer.name} さん
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {data.stats && (
              <button
                type="button"
                onClick={() => setBadgeOpen(true)}
                className="flex items-center gap-1 bg-amber-100 border border-amber-300 rounded-full pl-2 pr-3 py-1.5 active:bg-amber-200"
                aria-label="バッジ獲得・達成記録を開く"
              >
                <span className="text-lg leading-none">🏅</span>
                <span className="text-xs font-bold text-amber-800">
                  {data.stats.streakDays}日
                </span>
              </button>
            )}
            <Link
              href="/history"
              className="w-9 h-9 bg-white border border-stone-200 rounded-full flex items-center justify-center active:bg-stone-100 text-stone-700"
              aria-label="履歴カレンダーを開く"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="w-5 h-5"
              >
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </Link>
          </div>
        </div>

        {/* 日付ストリップ（7日間横スクロール） */}
        <DateStrip
          selectedDate={selectedDate}
          todayStr={todayStr}
          onSelect={(d) => navigateToDate(d)}
        />

        {/* 栄養サマリー（カロミル風） */}
        <NutritionSummaryCard totals={totals} goals={goals} />

        {/* クイックアクション */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <QuickAction href="/record" icon="📝" label="記録する" />
          <QuickAction href="/chat" icon="💬" label="AI食事相談" />
          <QuickAction href="/meal-plan" icon="🍱" label="AI献立作成" />
        </div>

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

            {/* AI体重予測 */}
            {isToday && (
              <PredictionBlock
                prediction={prediction}
                loading={predictionLoading}
                targetWeight={customer.targetWeight}
              />
            )}
          </div>
        )}

        {/* 今日の体重・運動（常時表示・タップで入力/編集） */}
        {isToday && userId && (
          <WeightExerciseCard
            selectedDate={selectedDate}
            lineUserId={userId}
            initialWeight={today.weight}
            initialExercised={today.exercised}
            initialExerciseContent={today.exerciseContent}
            onUpdated={() => {
              invalidate('today_');
              invalidate('weekly_');
              invalidate('history_');
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

        {/* 今日の食事（各食事をカード化） */}
        <h2 className="text-base font-bold text-stone-900 mb-2 px-1">🍽️ {isToday ? '今日' : 'この日'}の食事</h2>
        <div className="space-y-3 mb-4">
          {(['朝食', '昼食', '夕食', '間食'] as const).map((meal) => (
            <MealSection
              key={meal}
              mealType={meal}
              records={mealsByType[meal] || []}
              dayTotalKcal={totals.kcal}
              selectedDate={selectedDate}
              lineUserId={userId}
              onDeleted={() => {
                invalidate('today_');
                invalidate('weekly_');
                invalidate('history_');
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

      {/* バッジ詳細モーダル */}
      {badgeOpen && data.stats && (
        <BadgeModal stats={data.stats} onClose={() => setBadgeOpen(false)} />
      )}
    </main>
  );
}

function WeightExerciseCard({
  selectedDate,
  lineUserId,
  initialWeight,
  initialExercised,
  initialExerciseContent,
  onUpdated,
}: {
  selectedDate: string;
  lineUserId: string;
  initialWeight?: string;
  initialExercised?: string;
  initialExerciseContent?: string;
  onUpdated: () => void;
}) {
  const [weightOpen, setWeightOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);

  const hasWeight = !!initialWeight;
  const exercised = initialExercised === '✅';
  const hasExercise = !!initialExercised;

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3">📝 今日の記録</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setWeightOpen(true)}
          className={`flex flex-col items-start text-left rounded-xl p-3 border active:bg-stone-50 ${
            hasWeight ? 'bg-sky-50 border-sky-300' : 'bg-stone-50 border-stone-200 border-dashed'
          }`}
        >
          <div className="text-xs font-bold text-stone-700 mb-1">⚖️ 体重</div>
          {hasWeight ? (
            <div className="text-xl font-bold text-stone-900">
              {initialWeight}
              <span className="text-xs font-normal text-stone-500 ml-0.5">kg</span>
            </div>
          ) : (
            <div className="text-xs text-stone-500">タップで入力</div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setExerciseOpen(true)}
          className={`flex flex-col items-start text-left rounded-xl p-3 border active:bg-stone-50 ${
            hasExercise ? 'bg-amber-50 border-amber-300' : 'bg-stone-50 border-stone-200 border-dashed'
          }`}
        >
          <div className="text-xs font-bold text-stone-700 mb-1">🏃 運動</div>
          {hasExercise ? (
            <div>
              <div className="text-base font-bold text-stone-900">
                {exercised ? 'した' : 'なし'}
              </div>
              {exercised && initialExerciseContent && (
                <div className="text-[10px] text-stone-600 mt-0.5 truncate max-w-[120px]">
                  {initialExerciseContent}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-stone-500">タップで入力</div>
          )}
        </button>
      </div>

      {weightOpen && (
        <WeightSheet
          selectedDate={selectedDate}
          lineUserId={lineUserId}
          initialValue={initialWeight || ''}
          onClose={() => setWeightOpen(false)}
          onSaved={() => {
            setWeightOpen(false);
            onUpdated();
          }}
        />
      )}

      {exerciseOpen && (
        <ExerciseSheet
          selectedDate={selectedDate}
          lineUserId={lineUserId}
          initialExercised={exercised}
          initialContent={initialExerciseContent || ''}
          hasInitial={hasExercise}
          onClose={() => setExerciseOpen(false)}
          onSaved={() => {
            setExerciseOpen(false);
            onUpdated();
          }}
        />
      )}
    </div>
  );
}

function WeightSheet({
  selectedDate,
  lineUserId,
  initialValue,
  onClose,
  onSaved,
}: {
  selectedDate: string;
  lineUserId: string;
  initialValue: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 300) {
      setError('体重を 0〜300 の数値で入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/log/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, date: selectedDate, weight: w }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={saving ? undefined : onClose}>
      <div className="bg-white rounded-t-2xl shadow-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="pt-3 pb-2 border-b border-stone-200">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">⚖️ 体重を記録</h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">体重（kg）</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="300"
              inputMode="decimal"
              autoFocus
              placeholder="例：62.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-4 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-stone-500 mt-1">毎朝起床後・食事前の測定を推奨</p>
          </div>
          <button
            onClick={save}
            disabled={saving || !weight}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : initialValue ? '✏️ 上書き保存' : '✅ 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseSheet({
  selectedDate,
  lineUserId,
  initialExercised,
  initialContent,
  hasInitial,
  onClose,
  onSaved,
}: {
  selectedDate: string;
  lineUserId: string;
  initialExercised: boolean;
  initialContent: string;
  hasInitial: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [exercised, setExercised] = useState(initialExercised);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/log/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          date: selectedDate,
          exercised,
          content: exercised ? content : '',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={saving ? undefined : onClose}>
      <div className="bg-white rounded-t-2xl shadow-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="pt-3 pb-2 border-b border-stone-200">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">🏃 運動を記録</h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-2 block">運動した？</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExercised(true)}
                className={`py-3 rounded-xl text-sm font-bold ${
                  exercised
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-stone-700 border border-stone-300'
                }`}
              >
                ✅ した
              </button>
              <button
                type="button"
                onClick={() => setExercised(false)}
                className={`py-3 rounded-xl text-sm font-bold ${
                  !exercised
                    ? 'bg-stone-700 text-white'
                    : 'bg-stone-100 text-stone-700 border border-stone-300'
                }`}
              >
                ⬜ してない
              </button>
            </div>
          </div>
          {exercised && (
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">内容（任意）</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="例：ランニング30分、ジム筋トレ"
                rows={3}
                className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : hasInitial ? '✏️ 上書き保存' : '✅ 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BadgeModal({
  stats,
  onClose,
}: {
  stats: NonNullable<TodayData['stats']>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-end"
      onClick={onClose}
    >
      <div
        className="bg-stone-100 rounded-t-2xl shadow-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-stone-100 pt-3 pb-2 z-10 border-b border-stone-200">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">🏆 バッジ獲得・達成記録</h2>
            <button
              onClick={onClose}
              className="text-stone-500 text-2xl leading-none px-2 active:text-stone-700"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
        <div className="px-4 pb-8 pt-4">
          <StreakCard stats={stats} />
        </div>
      </div>
    </div>
  );
}

function DateStrip({
  selectedDate,
  todayStr,
  onSelect,
}: {
  selectedDate: string;
  todayStr: string;
  onSelect: (d: string) => void;
}) {
  // 過去6日 + 今日 の7日間を表示（先頭が古い、末尾が今日）
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(addDays(todayStr, -i));
  }

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="mb-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
        {dates.map((d) => {
          const [y, m, day] = d.split('-').map(Number);
          const date = new Date(y, m - 1, day);
          const weekday = weekdayNames[date.getDay()];
          const isSelected = d === selectedDate;
          const isToday = d === todayStr;
          const weekdayColor =
            date.getDay() === 0
              ? 'text-rose-600'
              : date.getDay() === 6
              ? 'text-sky-600'
              : 'text-stone-600';
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              className={`flex flex-col items-center justify-center min-w-[48px] py-2 rounded-2xl transition-all ${
                isSelected
                  ? 'bg-emerald-500 shadow-md'
                  : isToday
                  ? 'bg-white border-2 border-emerald-300'
                  : 'bg-white border border-stone-200'
              }`}
            >
              <span
                className={`text-[10px] font-bold ${
                  isSelected ? 'text-white' : weekdayColor
                }`}
              >
                {weekday}
              </span>
              <span
                className={`text-lg font-bold leading-tight ${
                  isSelected ? 'text-white' : 'text-stone-900'
                }`}
              >
                {day}
              </span>
              {isToday && !isSelected && (
                <span className="text-[8px] font-bold text-emerald-700 leading-none">今日</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center bg-white rounded-2xl py-3 px-1 border border-stone-200 shadow-sm active:bg-emerald-50"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] font-bold text-stone-900 mt-1 text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

function NutritionSummaryCard({
  totals,
  goals,
}: {
  totals: { kcal: number; P: number; F: number; C: number };
  goals: { kcal: number; P: number; F: number; C: number };
}) {
  const kcalPct = goals.kcal > 0 ? Math.round((totals.kcal / goals.kcal) * 100) : 0;

  // PFC比率（摂取分のkcalベース）
  const pKcal = totals.P * 4;
  const fKcal = totals.F * 9;
  const cKcal = totals.C * 4;
  const totalPfcKcal = pKcal + fKcal + cKcal;
  const pPct = totalPfcKcal > 0 ? Math.round((pKcal / totalPfcKcal) * 100) : 0;
  const fPct = totalPfcKcal > 0 ? Math.round((fKcal / totalPfcKcal) * 100) : 0;
  const cPct = totalPfcKcal > 0 ? Math.max(0, 100 - pPct - fPct) : 0;

  const nutrients = [
    { label: 'たんぱく質', value: r1(totals.P), goal: goals.P, unit: 'g', color: 'rose' as const },
    { label: '脂質', value: r1(totals.F), goal: goals.F, unit: 'g', color: 'amber' as const },
    { label: '炭水化物', value: r1(totals.C), goal: goals.C, unit: 'g', color: 'sky' as const },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold text-stone-900">栄養サマリー</h2>
        <span className="text-[11px] text-stone-500">{kcalPct}% 達成</span>
      </div>

      {/* カロリー大型表示 */}
      <div className="mb-4">
        <div className="text-xs text-stone-600 mb-1">カロリー</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-stone-900">{Math.round(totals.kcal)}</span>
          <span className="text-sm font-medium text-stone-500">/ {goals.kcal} kcal</span>
        </div>
        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, kcalPct) || 0}%` }}
          />
        </div>
      </div>

      {/* 3栄養素グリッド */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-3 mb-4">
        {nutrients.map((n) => {
          const pctRaw = n.goal > 0 ? Math.round((n.value / n.goal) * 100) : 0;
          const pct = Math.min(100, pctRaw);
          const barColor = barColorFor(n.color);
          const isOver = pctRaw > 130;
          const isUnder = pctRaw < 70;
          return (
            <div key={n.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-medium text-stone-700">{n.label}</span>
                {isOver && <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1 rounded">過剰</span>}
                {isUnder && <span className="text-[9px] font-bold text-sky-600 bg-sky-100 px-1 rounded">不足</span>}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-base font-bold text-stone-900">{n.value}</span>
                <span className="text-[10px] text-stone-500">/ {n.goal}{n.unit}</span>
              </div>
              <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* PFC比率 */}
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

function barColorFor(c: 'rose' | 'amber' | 'sky'): string {
  switch (c) {
    case 'rose': return 'bg-rose-500';
    case 'amber': return 'bg-amber-500';
    case 'sky': return 'bg-sky-500';
  }
}

function PredictionBlock({
  prediction,
  loading,
  targetWeight,
}: {
  prediction: PredictionData | null;
  loading: boolean;
  targetWeight: number | null;
}) {
  if (loading && !prediction) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="text-xs text-stone-500">🔮 AI予測を生成中…</div>
      </div>
    );
  }
  if (!prediction) return null;

  // データ不足の場合
  if (!prediction.prediction) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="text-xs font-bold text-stone-700 mb-1">🔮 3ヶ月後のAI予測</div>
        <div className="text-xs text-stone-600 bg-stone-50 rounded-lg p-2">
          {prediction.message || 'データ不足のため予測できません'}
        </div>
      </div>
    );
  }

  const p = prediction.prediction;
  const confidenceColor =
    p.confidenceLevel === 'high'
      ? 'text-emerald-700'
      : p.confidenceLevel === 'low'
      ? 'text-stone-500'
      : 'text-amber-700';
  const confidenceLabel =
    p.confidenceLevel === 'high' ? '高' : p.confidenceLevel === 'low' ? '低' : '中';
  const goalIcon =
    p.willReachGoal === true ? '✅' : p.willReachGoal === false ? '⚠️' : '';
  const changeIcon = p.monthlyChange < 0 ? '⬇️' : p.monthlyChange > 0 ? '⬆️' : '→';

  return (
    <div className="mt-3 pt-3 border-t border-stone-100">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-bold text-stone-700">🔮 3ヶ月後のAI予測</div>
        <div className={`text-[10px] font-medium ${confidenceColor}`}>
          信頼度：{confidenceLabel}
        </div>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-2">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-purple-700">
            {p.predictedWeight} kg
          </span>
          {targetWeight && (
            <span className="text-xs text-stone-600">
              （目標 {targetWeight} kg {goalIcon}）
            </span>
          )}
        </div>
        <div className="text-xs text-stone-700">
          {changeIcon} 月平均 {Math.abs(p.monthlyChange)} kg/月
        </div>
        {p.comment && (
          <div className="text-xs font-medium text-stone-800 mt-2">💬 {p.comment}</div>
        )}
      </div>
      {p.recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-stone-700">アドバイス</div>
          {p.recommendations.map((r, i) => (
            <div key={i} className="text-[11px] text-stone-700 bg-stone-50 rounded-lg px-2 py-1">
              ・{r}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-stone-500 mt-2">
        ※ 直近30日の食事・運動・体重データから推定。実際の体重変化と異なる場合があります。
      </div>
    </div>
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
  const badges: Array<{ icon: string; label: string; threshold: number }> = [
    { icon: '🥉', label: '3日連続記録', threshold: 3 },
    { icon: '🥈', label: '7日連続記録', threshold: 7 },
    { icon: '🥇', label: '14日連続記録', threshold: 14 },
    { icon: '👑', label: '30日連続記録', threshold: 30 },
  ];
  const achievedBadges = badges.filter((b) => bestStreakDays >= b.threshold);

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3">🏆 バッジ獲得・達成記録</h2>
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
  const pctBar = Math.min(100, pctRaw);
  // 過剰/良好/不足ラベル
  const labelStatus =
    pctRaw < 70 ? '不足' : pctRaw > 130 ? '過剰' : '良好';
  const labelStyle =
    labelStatus === '不足'
      ? 'text-sky-700 bg-sky-100 border-sky-300'
      : labelStatus === '過剰'
      ? 'text-rose-700 bg-rose-100 border-rose-300'
      : 'text-emerald-700 bg-emerald-100 border-emerald-300';
  const labelIcon =
    labelStatus === '不足' ? '💡' : labelStatus === '過剰' ? '⚠️' : '✨';

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
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${labelStyle}`}
          >
            {labelIcon} {labelStatus}
          </span>
        </div>
        <span className="font-bold text-stone-900">
          {value} / {goal} {unit}
          <span className="text-xs font-medium text-stone-500 ml-1">（{pctRaw}%）</span>
        </span>
      </div>
      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor[color]} transition-all`}
          style={{ width: `${pctBar}%` }}
        />
      </div>
    </div>
  );
}

function MealSection({
  mealType,
  records,
  dayTotalKcal,
  selectedDate,
}: {
  mealType: string;
  records: MealRecord[];
  dayTotalKcal: number;
  selectedDate: string;
  lineUserId: string | null;
  onDeleted: () => void;
}) {
  const emoji = MEAL_EMOJI[mealType] || '🍽️';
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
  const hasRecords = records.length > 0;
  const detailHref = `/meal-detail?date=${selectedDate}&meal=${encodeURIComponent(mealType)}`;
  const recordHref = `/record?meal=${encodeURIComponent(mealType)}`;
  const dbHref = `/food-search?meal=${encodeURIComponent(mealType)}`;
  const memoHref = `/record?meal=${encodeURIComponent(mealType)}&memo=1`;
  const myMenuHref = `/my-menu?meal=${encodeURIComponent(mealType)}`;

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <Link
        href={hasRecords ? detailHref : recordHref}
        className="block px-4 py-3 active:bg-stone-50"
      >
        <div className="flex justify-between items-center">
          <span className="font-bold text-stone-900">
            {emoji} {mealType}
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

      {hasRecords ? (
        <>
          <Link
            href={detailHref}
            className="block border-t border-stone-100 active:bg-stone-50"
          >
            <div className="divide-y divide-stone-100">
              {records.map((r) => {
                const isSkipped = r.memo === '食べなかった' || r.title === '食べなかった';
                const name = shortNameFromRecord(r);
                const unit = unitFromName(name);
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
      ) : (
        <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-700">
          <Link
            href={recordHref}
            className="flex items-center gap-1 font-medium active:text-emerald-700"
          >
            📷 写真
          </Link>
          <Link
            href={memoHref}
            className="flex items-center gap-1 font-medium active:text-emerald-700"
          >
            📝 テキストで記録
          </Link>
          <Link
            href={dbHref}
            className="flex items-center gap-1 font-medium active:text-emerald-700"
          >
            🔍 食品DB
          </Link>
          <Link
            href={myMenuHref}
            className="flex items-center gap-1 font-medium active:text-emerald-700"
          >
            ⭐ マイメニュー
          </Link>
        </div>
      )}
    </section>
  );
}

function shortNameFromRecord(r: MealRecord): string {
  const memo = (r.memo || '').trim();
  if (!memo) return r.title || '食事';
  const beforeAi = memo.split(/\s*\/\s*AI識別[:：]/)[0] || memo;
  const firstItem = beforeAi.split(/[、,]/)[0]?.trim();
  return firstItem || beforeAi.slice(0, 30);
}

function unitFromName(name: string): string {
  const m = name.match(/\s+([0-9０-９.]+\s*(g|ml|個|本|杯|皿|枚|切れ|人前|匹|玉|串|缶|袋|箱|食|kg))$/);
  if (m) return m[1].trim();
  const m2 = name.match(/[（(]([^）)]+)[）)]\s*$/);
  if (m2 && /[0-9０-９]/.test(m2[1])) return m2[1].trim();
  return '1人前';
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
