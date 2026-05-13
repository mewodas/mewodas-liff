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

        {/* 残りカロリー逆算サジェスト（当日のみ） */}
        {isToday && (
          <SuggestCard data={suggest} loading={suggestLoading} />
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

function SuggestCard({ data, loading }: { data: SuggestData | null; loading: boolean }) {
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
                  <div className="text-[11px] text-stone-500 mt-0.5 ml-1">💬 {s.reason}</div>
                )}
              </div>
            ))}
          </div>
          <div className="text-[11px] text-stone-500 mt-3 leading-relaxed">
            ※ 数値はAIによる推定値です。実際に食べた料理を写真で記録すると、その内容から計算された正確な数値が反映されます。
          </div>
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
