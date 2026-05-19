'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import { invalidate } from '@/lib/clientCache';
import PageHeader from '@/components/PageHeader';
import OnboardingTour from '@/components/OnboardingTour';
import { Footprints, CheckCircle2, Plus } from 'lucide-react';

const EXERCISE_TOUR_STEPS = [
  {
    target: 'exercise-type',
    title: '運動の種目を選びます',
    description: 'ランニング・筋トレ・ウォーキングなど、種目ボタンをタップして選択してください。',
    placement: 'bottom' as const,
  },
  {
    target: 'exercise-duration',
    title: '時間と強度を設定',
    description: '運動した時間（分）と強度を設定すると、消費カロリーが自動で推定されます。',
    placement: 'bottom' as const,
  },
  {
    target: 'exercise-save',
    title: '記録するで保存',
    description: 'このボタンをタップすると運動記録が保存されます。ホームのカードからでも入力できます。',
    placement: 'top' as const,
  },
];

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fmtJp(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${dayNames[date.getDay()]}）`;
}

const EXERCISE_OPTIONS = [
  { label: 'ランニング', category: '有酸素' },
  { label: 'ジョギング', category: '有酸素' },
  { label: 'ウォーキング', category: '有酸素' },
  { label: '筋トレ', category: '筋トレ' },
  { label: 'ヨガ', category: 'ストレッチ' },
  { label: 'ストレッチ', category: 'ストレッチ' },
  { label: 'その他', category: 'その他' },
] as const;

const CATEGORIES = ['有酸素', '筋トレ', 'ストレッチ', 'その他'] as const;
type Category = typeof CATEGORIES[number];

const INTENSITIES = ['軽い', '中等度', '激しい'] as const;
type Intensity = typeof INTENSITIES[number];

// MET値（種目 + 強度で補正）
const MET_MAP: Record<string, Record<Intensity, number>> = {
  ランニング: { 軽い: 6.0, 中等度: 8.0, 激しい: 11.0 },
  ジョギング: { 軽い: 5.0, 中等度: 7.0, 激しい: 9.0 },
  ウォーキング: { 軽い: 2.8, 中等度: 3.5, 激しい: 4.5 },
  筋トレ: { 軽い: 3.0, 中等度: 5.0, 激しい: 7.0 },
  ヨガ: { 軽い: 2.0, 中等度: 2.5, 激しい: 3.5 },
  ストレッチ: { 軽い: 1.8, 中等度: 2.3, 激しい: 3.0 },
  その他: { 軽い: 3.0, 中等度: 5.0, 激しい: 7.0 },
};

function calcKcal(exercise: string, durationMin: number, intensity: Intensity, weightKg: number): number {
  const key = exercise in MET_MAP ? exercise : 'その他';
  const met = MET_MAP[key][intensity];
  return Math.round(met * weightKg * (durationMin / 60) * 0.9);
}

export default function ExercisePage() {
  const router = useRouter();
  const todayStr = jstTodayString();
  const [userId, setUserId] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState<number>(60);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [exercise, setExercise] = useState('ランニング');
  const [customExercise, setCustomExercise] = useState('');
  const [category, setCategory] = useState<Category>('有酸素');
  const [durationMin, setDurationMin] = useState(30);
  const [intensity, setIntensity] = useState<Intensity>('中等度');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedLog, setSavedLog] = useState<{ exercise: string; durationMin: number; estimatedKcal: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tourResetAt, setTourResetAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
        try {
          const meRes = await apiFetch('/api/customer/me');
          if (meRes.ok) {
            const { customer } = await meRes.json();
            setTourResetAt(customer?.tourResetAt ?? null);
          } else {
            setTourResetAt(null);
          }
        } catch {
          setTourResetAt(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
        setTourResetAt(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // 顧客の体重を取得してkcal計算に使用
  useEffect(() => {
    if (!userId) return;
    apiFetch(`/api/today?date=${todayStr}&t=${Date.now()}`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const w = j?.customer?.currentWeight;
        if (w && Number.isFinite(w)) setWeightKg(w);
      })
      .catch(() => {});
  }, [userId, todayStr]);

  function handleExerciseChange(val: string) {
    setExercise(val);
    if (val !== 'その他') {
      const found = EXERCISE_OPTIONS.find((o) => o.label === val);
      if (found) setCategory(found.category as Category);
    }
  }

  const effectiveExercise = exercise === 'その他' ? (customExercise.trim() || 'その他') : exercise;
  const estimatedKcal = calcKcal(exercise === 'その他' ? 'その他' : exercise, durationMin, intensity, weightKg);

  async function handleSubmit() {
    if (!userId) {
      setError('LINEプロフィール未取得');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/exercise-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          exercise: effectiveExercise,
          category,
          durationMin,
          intensity,
          estimatedKcal,
          memo: memo.trim(),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `保存失敗（${res.status}）`);
      }
      setSavedLog({ exercise: effectiveExercise, durationMin, estimatedKcal });
      setSuccess(true);
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (success && savedLog) {
    return (
      <main className="min-h-screen bg-stone-100 pb-28">
        <PageHeader title="運動記録" Icon={Footprints} subtitle="今日の運動内容を入力" back />
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-md p-6 mb-4 border border-stone-200 text-center">
            <Footprints className="w-12 h-12 text-amber-500 mx-auto mb-2" strokeWidth={2} />
            <div className="text-2xl font-bold mb-2 text-stone-900 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" strokeWidth={2} />
              記録しました
            </div>
            <div className="text-sm text-stone-700 mb-3">{fmtJp(date)}</div>
            <div className="bg-stone-50 rounded-xl p-4 text-left space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">種目</span>
                <span className="font-bold text-stone-900">{savedLog.exercise}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">時間</span>
                <span className="font-bold text-stone-900">{savedLog.durationMin}分</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">推定消費</span>
                <span className="font-bold text-amber-600">{savedLog.estimatedKcal} kcal</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSuccess(false);
                setSavedLog(null);
                setMemo('');
              }}
              className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700"
            >
              <span className="inline-flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" strokeWidth={2.2} />
                もう一つ記録
              </span>
            </button>
            <button
              onClick={() => router.push('/home')}
              className="flex-1 bg-stone-300 text-stone-900 font-bold py-3 rounded-xl active:bg-stone-400"
            >
              ホームへ
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="運動記録" Icon={Footprints} subtitle="今日の運動内容を入力" back />
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl">
            {error}
          </div>
        )}

        {/* 日付 */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-3">日付</div>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-stone-50 text-stone-900 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* 種目 */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200" data-tour="exercise-type">
          <div className="text-base font-bold text-stone-900 mb-3">種目</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {EXERCISE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleExerciseChange(opt.label)}
                className={`px-3 py-1.5 text-sm rounded-xl font-bold border transition-colors ${
                  exercise === opt.label
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-stone-700 border-stone-300 active:bg-stone-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {exercise === 'その他' && (
            <input
              type="text"
              value={customExercise}
              onChange={(e) => setCustomExercise(e.target.value)}
              placeholder="種目を入力（例：水泳、サッカー）"
              className="w-full bg-stone-50 text-stone-900 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            />
          )}
          {exercise === 'その他' && (
            <div>
              <div className="text-xs font-bold text-stone-700 mb-2">カテゴリ</div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 text-xs rounded-lg font-bold border transition-colors ${
                      category === cat
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-white text-stone-600 border-stone-300 active:bg-stone-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 時間 + 強度 */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200" data-tour="exercise-duration">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-bold text-stone-900 mb-2">時間（分）</div>
              <input
                type="number"
                min={1}
                max={300}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                inputMode="numeric"
                className="w-full bg-stone-50 text-stone-900 border border-stone-300 rounded-xl p-3 text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-900 mb-2">強度</div>
              <div className="flex flex-col gap-1.5">
                {INTENSITIES.map((int) => (
                  <button
                    key={int}
                    type="button"
                    onClick={() => setIntensity(int)}
                    className={`py-1.5 text-xs rounded-xl font-bold border transition-colors ${
                      intensity === int
                        ? int === '軽い'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : int === '中等度'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-rose-500 text-white border-rose-500'
                        : 'bg-white text-stone-600 border-stone-300 active:bg-stone-50'
                    }`}
                  >
                    {int}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 推定消費kcal */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <div className="text-xs text-amber-700 font-bold mb-0.5">推定消費カロリー</div>
            <div className="text-2xl font-bold text-amber-600">{estimatedKcal} <span className="text-sm font-bold">kcal</span></div>
            <div className="text-[10px] text-stone-500 mt-0.5">体重 {weightKg}kg 基準（MET法）</div>
          </div>
        </div>

        {/* メモ */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-2">メモ（任意）</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例：坂道コース、自重のみ、翌日筋肉痛"
            rows={2}
            className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          data-tour="exercise-save"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-500 text-white text-lg font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
        >
          {submitting ? '保存中…' : (
            <span className="inline-flex items-center justify-center gap-1">
              <CheckCircle2 className="w-5 h-5" strokeWidth={2.2} />
              運動を記録する
            </span>
          )}
        </button>

        {ready && tourResetAt !== undefined && (
          <OnboardingTour storageKey="fitmeal_tour_exercise_done" steps={EXERCISE_TOUR_STEPS} tourResetAt={tourResetAt} />
        )}
      </div>
    </main>
  );
}
