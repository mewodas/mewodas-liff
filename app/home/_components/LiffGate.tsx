'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import { getCached, setCached, invalidate } from '@/lib/clientCache';
import WeightExerciseCard from '@/components/WeightExerciseCard';
import MealRatioChart from '@/components/MealRatioChart';
import OnboardingFlow from '@/components/OnboardingFlow';
import { UtensilsCrossed, RefreshCw, Bell, MessageCircle, ChefHat } from 'lucide-react';
import type { TodayData, PredictionData, MealRecord } from './types';
import { DateStrip } from './DateStrip';
import { BadgeModal } from './BadgeModal';
import { NutritionSummaryCard } from './NutritionSummaryCard';
import { PredictionBlock } from './PredictionBlock';
import { MealSection } from './MealListSection';
import { QuickAction } from './QuickActions';
import { GoalProgressCard } from './GoalProgressCard';

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatJpDate(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${dayNames[date.getDay()]}）`;
}

function LiffGateInner() {
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
  const [refetching, setRefetching] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/customer/me`, { cache: 'no-store' });
        if (!res.ok) {
          setOnboardingDone(true);
          return;
        }
        const j = await res.json();
        setOnboardingDone(!!j.customer?.onboardingCompletedAt);
      } catch {
        setOnboardingDone(true);
      }
    })();
  }, [userId]);

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
        const res = await apiFetch(`/api/predict-weight?t=${Date.now()}`, { cache: 'no-store' });
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
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/notifications?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setUnreadCount(j.unreadCount || 0);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const cacheKey = `today_v2_${userId}_${selectedDate}`;
    const cached = getCached<TodayData>(cacheKey);
    if (cached) {
      setData(cached.data);
      setReady(true);
      if (!cached.isStale) {
        setError(null);
        return;
      }
      setRefetching(true);
    } else if (data) {
      setRefetching(true);
    } else {
      setReady(false);
    }
    setError(null);
    (async () => {
      try {
        const [todayRes, extrasRes] = await Promise.all([
          apiFetch(`/api/today?date=${selectedDate}&t=${Date.now()}`, { cache: 'no-store' }),
          apiFetch(`/api/extras?date=${selectedDate}&t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (!todayRes.ok) {
          const errJson = await todayRes.json().catch(() => ({}));
          throw new Error(errJson.error || `データ取得失敗（${todayRes.status}）`);
        }
        const json: TodayData = await todayRes.json();
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

  const showOnboarding = onboardingDone === false && !!userId;
  const { customer, today } = data;
  const { totals, mealsByType } = today;
  const { goals } = customer;
  const dateLabel = formatJpDate(today.date);
  const effectiveCurrentWeight = today.weight ? parseFloat(today.weight) : customer.currentWeight;

  function handleWeightUpdated() {
    invalidate('today_');
    invalidate('weekly_');
    invalidate('history_');
    if (userId) {
      apiFetch(`/api/extras?date=${selectedDate}&t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((extras) => {
          if (!extras) return;
          setData((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              today: {
                ...prev.today,
                weight: extras.weight || '',
                exercised: extras.exercised || '',
                exerciseContent: extras.exerciseContent || '',
              },
            };
            setCached(`today_v2_${userId}_${selectedDate}`, updated);
            return updated;
          });
        })
        .catch(() => {});
    }
  }

  function handleMealDeleted() {
    invalidate('today_');
    invalidate('weekly_');
    invalidate('history_');
    router.refresh();
    if (userId) {
      apiFetch(`/api/today?date=${selectedDate}&t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((json) => {
          setData(json);
          setCached(`today_v2_${userId}_${selectedDate}`, json);
        })
        .catch(() => {});
    }
  }

  return (
    <>
      {showOnboarding && userId && (
        <OnboardingFlow customerName={data.customer.name} lineUserId={userId} />
      )}
      <main className="min-h-screen bg-stone-100 pb-28">
        {refetching && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-sm rounded-full w-16 h-16 shadow-xl border border-stone-200 flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" strokeWidth={2.4} />
            </div>
          </div>
        )}
        <div className="max-w-md mx-auto">
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
            <div data-tour="date-strip">
              <DateStrip
                selectedDate={selectedDate}
                todayStr={todayStr}
                onSelect={(d) => navigateToDate(d)}
              />
            </div>
          </div>

          <div className="px-4 pt-2">
            <div
              data-tour="nutrition-summary"
              className={`transition-opacity duration-300 ${refetching ? 'opacity-50' : 'opacity-100'}`}
            >
              <NutritionSummaryCard totals={totals} goals={goals} />
            </div>

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
                  onUpdated={handleWeightUpdated}
                />
              </div>
            )}

            <GoalProgressCard
              customer={{ ...customer, currentWeight: effectiveCurrentWeight }}
              isToday={isToday}
              prediction={prediction}
              predictionLoading={predictionLoading}
            />

            <div className={`transition-opacity duration-300 ${refetching ? 'opacity-50' : 'opacity-100'}`}>
              <h2 className="text-base font-bold text-stone-900 mb-2 px-1 flex items-center gap-1.5" data-tour="meal-section">
                <UtensilsCrossed className="w-4 h-4 text-stone-700" strokeWidth={2.2} />
                {isToday ? '今日' : 'この日'}の食事
              </h2>
              <MealRatioChart
                mealRatio={(['朝食', '昼食', '夕食', '間食'] as const).reduce(
                  (acc, t) => ({
                    ...acc,
                    [t]: (mealsByType[t] || []).reduce((s, r: MealRecord) => s + r.kcal, 0),
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
                    onDeleted={handleMealDeleted}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {badgeOpen && data.stats && (
          <BadgeModal stats={data.stats} onClose={() => setBadgeOpen(false)} />
        )}
      </main>
    </>
  );
}

export default function LiffGate() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-stone-100">
          <div className="text-stone-800">読み込み中...</div>
        </main>
      }
    >
      <LiffGateInner />
    </Suspense>
  );
}
