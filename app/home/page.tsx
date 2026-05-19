'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import { getCached, setCached, invalidate } from '@/lib/clientCache';
import { useDraggableSheet } from '@/lib/useDraggableSheet';
import WeightExerciseCard from '@/components/WeightExerciseCard';
import MealRatioChart from '@/components/MealRatioChart';
import OnboardingFlow from '@/components/OnboardingFlow';
import {
  Calendar as CalendarIcon,
  ClipboardList,
  MessageCircle,
  ChefHat,
  Target,
  Trophy,
  Flame,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Ban,
  UtensilsCrossed,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Bell,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

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
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [refetching, setRefetching] = useState(false); // 日付切替時の再fetch中フラグ
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null); // null=未確認

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

  // オンボーディング完了状態を確認
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/customer/me`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setOnboardingDone(true); // エラー時はオンボーディングをスキップ
          return;
        }
        const j = await res.json();
        setOnboardingDone(!!j.customer?.onboardingCompletedAt);
      } catch {
        setOnboardingDone(true);
      }
    })();
  }, [userId]);

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
        const res = await apiFetch(
          `/api/predict-weight?t=${Date.now()}`,
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

  // 未読通知数を取得（軽量・ホームでのみ）
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/notifications?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setUnreadCount(j.unreadCount || 0);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      // ステイル → バックグラウンドで再fetch、現データは表示し続ける
      setRefetching(true);
    } else if (data) {
      // 別日のキャッシュなし: 旧データを薄く表示しつつ取得（リロード感を消す）
      setRefetching(true);
    } else {
      // 初回マウント時のみ「読み込み中...」表示
      setReady(false);
    }
    setError(null);
    (async () => {
      try {
        // /api/today（食事・バッジ）と /api/extras（体重・運動）を並列fetch
        const [todayRes, extrasRes] = await Promise.all([
          apiFetch(
            `/api/today?date=${selectedDate}&t=${Date.now()}`,
            { cache: 'no-store' }
          ),
          apiFetch(
            `/api/extras?date=${selectedDate}&t=${Date.now()}`,
            { cache: 'no-store' }
          ).catch(() => null),
        ]);
        if (!todayRes.ok) {
          const errJson = await todayRes.json().catch(() => ({}));
          throw new Error(errJson.error || `データ取得失敗（${todayRes.status}）`);
        }
        const json: TodayData = await todayRes.json();
        // extras を today に統合
        if (extrasRes && extrasRes.ok) {
          const extras = await extrasRes.json().catch(() => null);
          if (extras) {
            json.today.weight = extras.weight || '';
            json.today.exercised = extras.exercised || '';
            json.today.exerciseContent = extras.exerciseContent || '';
          }
        }
        setData(json);
        setCached(cacheKey, json);
      } catch (e) {
        if (!cached) setError(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setReady(true);
        setRefetching(false);
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
          <Link href="/record" className="block mt-4 bg-emerald-500 text-white text-center font-bold py-3 rounded-xl">
            食事記録へ
          </Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  // オンボーディング未完了かつ状態確認済みならフローを表示
  if (onboardingDone === false && userId && data) {
    return (
      <>
        <OnboardingFlow customerName={data.customer.name} lineUserId={userId} />
        <main className="min-h-screen bg-stone-100 pb-28" aria-hidden />
      </>
    );
  }

  const { customer, today } = data;
  const { totals, mealsByType } = today;
  const { goals } = customer;
  const dateLabel = formatJpDate(today.date);
  // 「現在体重」は今日の体重ログがあればそれを優先（顧客DBの値は手動更新されないと固まるため）
  const effectiveCurrentWeight = today.weight
    ? parseFloat(today.weight)
    : customer.currentWeight;
  const goalProgress = calcGoalProgress({ ...customer, currentWeight: effectiveCurrentWeight });

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      {/* 更新中インジケーター（あすけん風・中央オーバーレイ） */}
      {refetching && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm rounded-full w-16 h-16 shadow-xl border border-stone-200 flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" strokeWidth={2.4} />
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto">
        {/* sticky ヘッダー：日付ラベル＋バッジ＋ベル＋カレンダー + 日付ストリップ */}
        <div className="sticky top-0 z-30 bg-stone-100 px-4 pt-2 pb-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-stone-800 leading-none">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {data.stats && (
              <button
                type="button"
                onClick={() => setBadgeOpen(true)}
                className="flex items-center gap-1 bg-amber-100 border border-amber-300 rounded-full pl-2 pr-3 py-1.5 active:bg-amber-200"
                aria-label="バッジ獲得・達成記録を開く"
              >
                <span className="text-sm leading-none">🏅</span>
                <span className="text-xs font-bold text-amber-800">
                  {data.stats.streakDays}日
                </span>
              </button>
            )}
            <Link
              href="/notifications"
              className="relative w-9 h-9 bg-white border border-stone-200 rounded-full flex items-center justify-center active:bg-stone-100 text-stone-700"
              aria-label={`お知らせを開く（未読${unreadCount}件）`}
            >
              <Bell className="w-5 h-5" strokeWidth={2.2} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
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
        <div data-tour="date-strip">
          <DateStrip
            selectedDate={selectedDate}
            todayStr={todayStr}
            onSelect={(d) => navigateToDate(d)}
          />
        </div>
        </div>

        <div className="px-4 pt-2">
        {/* 栄養サマリー（カロミル風）— 日付切替中は薄くして fade */}
        <div
          data-tour="nutrition-summary"
          className={`transition-opacity duration-300 ${refetching ? 'opacity-50' : 'opacity-100'}`}
        >
          <NutritionSummaryCard totals={totals} goals={goals} />
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <QuickAction
            href={`/record${isToday ? '' : `?date=${selectedDate}`}`}
            icon={<UtensilsCrossed className="w-5 h-5 text-emerald-600" strokeWidth={2} />}
            label="食事記録"
          />
          <QuickAction
            href="/chat"
            icon={<MessageCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />}
            label="AI食事相談"
          />
          <QuickAction
            href={`/meal-plan${isToday ? '' : `?date=${selectedDate}`}`}
            icon={<ChefHat className="w-5 h-5 text-emerald-600" strokeWidth={2} />}
            label="AI献立作成"
          />
        </div>

        {/* 体重・運動カード（未来日以外で表示。過去日もタップで入力/編集可能） */}
        {userId && selectedDate <= todayStr && (
          <div
            data-tour="today-record-card"
            className={`transition-opacity duration-300 ${refetching ? 'opacity-50' : 'opacity-100'}`}
          >
          <WeightExerciseCard
            selectedDate={selectedDate}
            isToday={isToday}
            lineUserId={userId}
            initialWeight={today.weight}
            initialExercised={today.exercised}
            initialExerciseContent={today.exerciseContent}
            onUpdated={() => {
              invalidate('today_');
              invalidate('weekly_');
              invalidate('history_');
              if (userId) {
                // today + extras を並列再 fetch して体重・運動の最新値を反映
                Promise.all([
                  apiFetch(
                    `/api/today?date=${selectedDate}&t=${Date.now()}`,
                    { cache: 'no-store' }
                  ).then((r) => r.json()),
                  apiFetch(
                    `/api/extras?date=${selectedDate}&t=${Date.now()}`,
                    { cache: 'no-store' }
                  ).then((r) => r.json()).catch(() => null),
                ])
                  .then(([json, extras]) => {
                    if (extras) {
                      json.today.weight = extras.weight || '';
                      json.today.exercised = extras.exercised || '';
                      json.today.exerciseContent = extras.exerciseContent || '';
                    }
                    setData(json);
                    setCached(`today_v2_${userId}_${selectedDate}`, json);
                  })
                  .catch(() => {});
              }
            }}
          />
          </div>
        )}

        {/* 体重目標 */}
        {goalProgress && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
            <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              体重目標進捗
            </h2>
            <div className="space-y-1 text-sm text-stone-800">
              <div className="flex justify-between">
                <span className="text-stone-600">現在</span>
                <span className="font-bold">{goalProgress.currentW} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">目標</span>
                <span className="font-bold">{goalProgress.targetW} kg</span>
              </div>
              {(() => {
                const sign = goalProgress.targetW < goalProgress.currentW ? '-' : goalProgress.targetW > goalProgress.currentW ? '+' : '';
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-600">残り</span>
                      <span className="font-bold text-emerald-700">{sign}{goalProgress.remainingKg} kg</span>
                    </div>
                    {goalProgress.remainingWeeks !== null && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-stone-600">期限</span>
                          <span className="font-bold">あと {goalProgress.remainingWeeks} 週</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-stone-100">
                          <span className="text-stone-600">必要ペース</span>
                          <span className="font-bold text-emerald-700">{sign}{goalProgress.requiredPace} kg/週</span>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
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

        {/* 今日の食事（各食事をカード化） */}
        <div className={`transition-opacity duration-300 ${refetching ? 'opacity-50' : 'opacity-100'}`}>
        <h2 className="text-base font-bold text-stone-900 mb-2 px-1 flex items-center gap-1.5" data-tour="meal-section">
          <UtensilsCrossed className="w-4 h-4 text-stone-700" strokeWidth={2.2} />
          {isToday ? '今日' : 'この日'}の食事
        </h2>
        <MealRatioChart
          mealRatio={(['朝食', '昼食', '夕食', '間食'] as const).reduce(
            (acc, t) => ({
              ...acc,
              [t]: (mealsByType[t] || []).reduce((s, r) => s + r.kcal, 0),
            }),
            {} as Record<string, number>
          )}
        />
        <div className="space-y-3 mb-4" data-onboarding="meal-cards">
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
                  apiFetch(
                    `/api/today?date=${selectedDate}&t=${Date.now()}`,
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
        </div>

      </div>

      {/* バッジ詳細モーダル */}
      {badgeOpen && data.stats && (
        <BadgeModal stats={data.stats} onClose={() => setBadgeOpen(false)} />
      )}

    </main>
  );
}

function BadgeModal({
  stats,
  onClose,
}: {
  stats: NonNullable<TodayData['stats']>;
  onClose: () => void;
}) {
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-end"
      onClick={onClose}
    >
      <div
        className={`bg-stone-100 shadow-2xl w-full overflow-y-auto ${
          expanded ? 'h-full rounded-none' : 'rounded-t-2xl max-h-[85vh]'
        }`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...handleProps}
          className="sticky top-0 bg-stone-100 pt-3 pb-2 z-10 border-b border-stone-200 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
              バッジ獲得・達成記録
            </h2>
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
  // 過去14日 + 今日 + 未来7日 = 22日間を横スクロール
  const dates: string[] = [];
  for (let i = 14; i >= 1; i--) dates.push(addDays(todayStr, -i));
  dates.push(todayStr);
  for (let i = 1; i <= 7; i++) dates.push(addDays(todayStr, i));

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const isFirstScrollRef = useRef(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const container = scrollRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 4);
    setCanScrollRight(
      container.scrollLeft + container.clientWidth < container.scrollWidth - 4
    );
  }

  function scrollByAmount(delta: number) {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  }

  // 選択日が変わるたびに、選択日のセルを中央にスクロール
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const container = scrollRef.current;
      const btn = selectedRef.current;
      if (!container || !btn) return;
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const offsetInScroll =
        btnRect.left - containerRect.left + container.scrollLeft;
      const targetLeft =
        offsetInScroll - container.clientWidth / 2 + btn.clientWidth / 2;
      // 初回はジャンプ、それ以降はスムーススクロール
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: isFirstScrollRef.current ? 'auto' : 'smooth',
      });
      isFirstScrollRef.current = false;
      updateArrows();
    });
    return () => cancelAnimationFrame(id);
  }, [selectedDate]);

  return (
    <div className="mb-1 -mx-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => scrollByAmount(-200)}
        disabled={!canScrollLeft}
        className="w-7 h-7 rounded-full bg-white border border-stone-300 shadow-sm flex items-center justify-center text-stone-700 text-xs font-bold active:bg-stone-100 disabled:opacity-30 flex-shrink-0"
        aria-label="前の日付へ"
      >
        ◀
      </button>
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="flex-1 overflow-x-auto scrollbar-hide"
      >
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
              ref={isSelected ? selectedRef : undefined}
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
      <button
        type="button"
        onClick={() => scrollByAmount(200)}
        disabled={!canScrollRight}
        className="w-7 h-7 rounded-full bg-white border border-stone-300 shadow-sm flex items-center justify-center text-stone-700 text-xs font-bold active:bg-stone-100 disabled:opacity-30 flex-shrink-0"
        aria-label="次の日付へ"
      >
        ▶
      </button>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center bg-white rounded-2xl py-3 px-1 border border-stone-200 shadow-sm active:bg-emerald-50"
    >
      <span className="flex items-center justify-center">{icon}</span>
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
      <h2 className="text-base font-bold text-stone-900 mb-3">栄養サマリー</h2>

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
        <div className="text-xs text-stone-500 inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" strokeWidth={2.2} />
          AI予測を生成中…
        </div>
      </div>
    );
  }
  if (!prediction) return null;

  // データ不足の場合
  if (!prediction.prediction) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" strokeWidth={2.2} />
          3ヶ月後のAI予測
        </div>
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
  const GoalIcon =
    p.willReachGoal === true ? CheckCircle2 : p.willReachGoal === false ? AlertTriangle : null;
  const goalIconColor = p.willReachGoal === true ? 'text-emerald-600' : 'text-amber-600';
  const ChangeIcon = p.monthlyChange < 0 ? TrendingDown : p.monthlyChange > 0 ? TrendingUp : ArrowRight;

  return (
    <div className="mt-3 pt-3 border-t border-stone-100">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-bold text-stone-700 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" strokeWidth={2.2} />
          3ヶ月後のAI予測
        </div>
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
            <span className="text-xs text-stone-600 inline-flex items-center gap-0.5">
              （目標 {targetWeight} kg
              {GoalIcon && <GoalIcon className={`w-3 h-3 ${goalIconColor}`} strokeWidth={2.2} />}）
            </span>
          )}
        </div>
        <div className="text-xs text-stone-700 inline-flex items-center gap-1">
          <ChangeIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
          月平均 {Math.abs(p.monthlyChange)} kg/月
        </div>
        {p.comment && (
          <div className="text-xs font-medium text-stone-800 mt-2 inline-flex items-center gap-1">
            <MessageCircle className="w-3 h-3" strokeWidth={2.2} />
            {p.comment}
          </div>
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
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <Trophy className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
        バッジ獲得・達成記録
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-600" strokeWidth={2.2} />
            連続記録日数
          </div>
          <div className="text-2xl font-bold text-orange-700 mt-0.5">
            {streakDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            今、何日連続で記録中か
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-600" strokeWidth={2.2} />
            最長連続記録
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-0.5">
            {bestStreakDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            直近30日のベスト記録
          </div>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.2} />
            今月の記録日数
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-0.5">
            {monthlyRecordedDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            今月、食事を記録した日数
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
            直近30日の記録
          </div>
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
  const LabelIcon =
    labelStatus === '不足' ? Lightbulb : labelStatus === '過剰' ? AlertTriangle : Sparkles;

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
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-0.5 ${labelStyle}`}
          >
            <LabelIcon className="w-3 h-3" strokeWidth={2.2} />
            {labelStatus}
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
  const Icon = MEAL_ICON[mealType] || UtensilsCrossed;
  const iconColor = MEAL_COLOR[mealType] || 'text-stone-600';
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
  const datePart = `date=${selectedDate}`;
  const detailHref = `/meal-detail?${datePart}&meal=${encodeURIComponent(mealType)}`;
  const recordHref = `/record?${datePart}&meal=${encodeURIComponent(mealType)}`;

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <Link
        href={hasRecords ? detailHref : recordHref}
        className="block px-4 py-3 active:bg-stone-50"
      >
        <div className="flex justify-between items-center">
          <span className="font-bold text-stone-900 flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2.2} />
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
                {Array.from(
                  records
                    .filter((r) => r.imageUrl)
                    .reduce((map, r) => {
                      const key = r.imageUrl!;
                      if (!map.has(key)) map.set(key, r);
                      return map;
                    }, new Map<string, MealRecord>())
                    .values(),
                ).map((r) => (
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
        <Link
          href={recordHref}
          className="block px-4 pb-3 active:bg-stone-50"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <UtensilsCrossed className="w-3.5 h-3.5" strokeWidth={2.2} />
            食事を記録する
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
          </span>
        </Link>
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
