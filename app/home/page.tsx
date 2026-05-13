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
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

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
        {/* ヘッダー：挨拶 */}
        <div className="mb-3">
          <h1 className="text-xl font-bold text-stone-900">こんにちは、{customer.name} さん</h1>
          <p className="text-xs text-stone-600 mt-0.5">{dateLabel}</p>
        </div>

        {/* 日付ストリップ（7日間横スクロール） */}
        <DateStrip
          selectedDate={selectedDate}
          todayStr={todayStr}
          onSelect={(d) => navigateToDate(d)}
        />

        {/* 今日の摂取（カロリー大型表示） */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3">📊 今日の摂取</h2>

          {/* カロリー大型サマリ */}
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-4 mb-4 border border-emerald-100">
            <div className="text-xs font-medium text-stone-600 mb-1">カロリー</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-emerald-700">
                {Math.round(totals.kcal)}
              </span>
              <span className="text-sm font-medium text-stone-600">/ {goals.kcal} kcal</span>
            </div>
            <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                style={{
                  width: `${Math.min(100, Math.round((totals.kcal / goals.kcal) * 100)) || 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-stone-600">
              <span>
                残り {Math.max(0, Math.round(goals.kcal - totals.kcal))} kcal
              </span>
              <span className="font-bold">
                {goals.kcal > 0 ? Math.round((totals.kcal / goals.kcal) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* PFCバー（3つ） */}
          <ProgressRow label="タンパク質" value={r1(totals.P)} goal={goals.P} unit="g" color="rose" />
          <ProgressRow label="脂質" value={r1(totals.F)} goal={goals.F} unit="g" color="amber" />
          <ProgressRow label="炭水化物" value={r1(totals.C)} goal={goals.C} unit="g" color="sky" />
        </div>

        {/* 詳細栄養素（記録がある日のみ） */}
        <NutritionDetailsCard mealsByType={mealsByType} />

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

function NutritionDetailsCard({
  mealsByType,
}: {
  mealsByType: Record<string, MealRecord[]>;
}) {
  const [expanded, setExpanded] = useState(false);

  // 全食事レコードから詳細栄養素を合計
  const totals = { fiber: 0, salt: 0, iron: 0, calcium: 0, vitaminC: 0 };
  let hasAny = false;
  for (const records of Object.values(mealsByType)) {
    for (const r of records) {
      if (r.details) {
        totals.fiber += r.details.fiber || 0;
        totals.salt += r.details.salt || 0;
        totals.iron += r.details.iron || 0;
        totals.calcium += r.details.calcium || 0;
        totals.vitaminC += r.details.vitaminC || 0;
        hasAny = true;
      }
    }
  }
  if (!hasAny) return null;

  const f1 = (x: number) => Math.round(x * 10) / 10;
  // 日本人の食事摂取基準（成人男性、参考値）
  const dailyReference = {
    fiber: 21, // g
    salt: 7.5, // g（上限値）
    iron: 7.5, // mg
    calcium: 800, // mg
    vitaminC: 100, // mg
  };

  const items = [
    { label: '🌾 食物繊維', value: f1(totals.fiber), unit: 'g', ref: dailyReference.fiber },
    { label: '🧂 食塩', value: f1(totals.salt), unit: 'g', ref: dailyReference.salt, isLimit: true },
    { label: '🩸 鉄', value: f1(totals.iron), unit: 'mg', ref: dailyReference.iron },
    { label: '🦴 カルシウム', value: Math.round(totals.calcium), unit: 'mg', ref: dailyReference.calcium },
    { label: '🍊 ビタミンC', value: Math.round(totals.vitaminC), unit: 'mg', ref: dailyReference.vitaminC },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="text-base font-bold text-stone-900">🔬 詳細栄養素</h2>
        <span className="text-stone-500 text-xs">
          {expanded ? '閉じる ▲' : 'もっと詳しく ▼'}
        </span>
      </button>
      {expanded && (
        <>
          <div className="mt-3 space-y-2">
            {items.map((it) => {
              const pctRaw = Math.round((it.value / it.ref) * 100);
              const pct = Math.min(100, pctRaw);
              // 状態判定（食塩は上限なので逆ロジック）
              let labelStatus: '不足' | '良好' | '過剰';
              if (it.isLimit) {
                labelStatus = pctRaw > 100 ? '過剰' : pctRaw > 80 ? '良好' : '良好';
              } else {
                labelStatus = pctRaw < 70 ? '不足' : pctRaw > 130 ? '過剰' : '良好';
              }
              const labelStyle =
                labelStatus === '不足'
                  ? 'text-sky-700 bg-sky-100 border-sky-300'
                  : labelStatus === '過剰'
                  ? 'text-rose-700 bg-rose-100 border-rose-300'
                  : 'text-emerald-700 bg-emerald-100 border-emerald-300';
              const labelIcon =
                labelStatus === '不足' ? '💡' : labelStatus === '過剰' ? '⚠️' : '✨';
              return (
                <div key={it.label}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800">{it.label}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${labelStyle}`}
                      >
                        {labelIcon} {labelStatus}
                      </span>
                    </div>
                    <span className="font-bold text-stone-900">
                      {it.value} <span className="text-xs text-stone-500">{it.unit}</span>
                      <span className="text-xs font-medium text-stone-500 ml-1">
                        （{pctRaw}%）
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        it.isLimit
                          ? pct > 100
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-stone-500 mt-3 leading-relaxed">
            ※ AIによる推定値です。実際の値と異なる場合があります。日本人の食事摂取基準（成人）を参考目安として表示。
          </div>
        </>
      )}
    </div>
  );
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
