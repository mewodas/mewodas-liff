'use client';

import { useEffect, useState } from 'react';
import { initLiff, getLineProfile } from '@/lib/liff';
import PageHeader from '@/components/PageHeader';
import { Target, Calendar, TrendingDown } from 'lucide-react';

type GoalsData = {
  name: string;
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  plan: string | null;
  activityLevel: string | null;
};

function daysUntil(dateStr: string): number {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

function WeightProgressBar({
  current,
  target,
}: {
  current: number;
  target: number;
}) {
  const startWeight = Math.max(current, target) + Math.abs(current - target) * 0.2;
  const totalRange = startWeight - Math.min(current, target);
  const achieved = totalRange > 0
    ? Math.min(100, Math.max(0, Math.round(((startWeight - current) / (startWeight - target)) * 100)))
    : 0;

  return (
    <div>
      <div className="flex justify-between text-xs text-stone-600 mb-1.5">
        <span>現在 {current} kg</span>
        <span>目標 {target} kg</span>
      </div>
      <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all rounded-full"
          style={{ width: `${achieved}%` }}
        />
      </div>
      <div className="text-right text-[11px] font-bold text-emerald-700 mt-1">{achieved}% 達成</div>
    </div>
  );
}

export default function GoalsPage() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<GoalsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const lineProfile = await getLineProfile();
        if (!lineProfile) {
          setError('LINEプロフィール取得失敗');
          setReady(true);
          return;
        }
        const res = await fetch(
          `/api/customer/me?lineUserId=${encodeURIComponent(lineProfile.userId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const c = j.customer;
        setData({
          name: c.name,
          currentWeight: c.currentWeight,
          targetWeight: c.targetWeight,
          targetDate: c.targetDate,
          goals: c.goals,
          plan: c.plan,
          activityLevel: c.activityLevel,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
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

  const remaining = data?.targetDate ? daysUntil(data.targetDate) : null;

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="目標" Icon={Target} subtitle="体重・栄養目標" back />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
          トレーナーが設定した目標です。変更が必要な場合はトレーナーにご連絡ください。
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {data && (
          <>
            {/* 体重目標 */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                体重目標
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard
                  label="現在体重"
                  value={data.currentWeight !== null ? `${data.currentWeight}` : '—'}
                  unit="kg"
                  color="sky"
                />
                <StatCard
                  label="目標体重"
                  value={data.targetWeight !== null ? `${data.targetWeight}` : '—'}
                  unit="kg"
                  color="emerald"
                />
              </div>
              {data.currentWeight !== null && data.targetWeight !== null && (
                <WeightProgressBar
                  current={data.currentWeight}
                  target={data.targetWeight}
                />
              )}
            </section>

            {/* 目標達成日 */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-500" strokeWidth={2.2} />
                目標達成日
              </h2>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-900">{formatDate(data.targetDate)}</span>
                {remaining !== null && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    remaining <= 0
                      ? 'bg-rose-100 text-rose-700'
                      : remaining <= 30
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {remaining <= 0 ? '期限終了' : `あと ${remaining} 日`}
                  </span>
                )}
              </div>
            </section>

            {/* 1日の栄養目標 */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
                1日の栄養目標
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="カロリー"
                  value={`${data.goals.kcal}`}
                  unit="kcal"
                  color="orange"
                />
                <StatCard
                  label="たんぱく質"
                  value={`${data.goals.P}`}
                  unit="g"
                  color="rose"
                />
                <StatCard
                  label="脂質"
                  value={`${data.goals.F}`}
                  unit="g"
                  color="amber"
                />
                <StatCard
                  label="炭水化物"
                  value={`${data.goals.C}`}
                  unit="g"
                  color="sky"
                />
              </div>
            </section>

            {/* プラン・活動レベル */}
            {(data.plan || data.activityLevel) && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {data.plan && (
                  <div className={`flex items-center px-4 py-3 gap-3 ${data.activityLevel ? 'border-b border-stone-100' : ''}`}>
                    <span className="text-xs text-stone-500 w-24 flex-shrink-0">プラン</span>
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                      data.plan === '減量'
                        ? 'bg-red-100 text-red-700'
                        : data.plan === '増量'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-stone-100 text-stone-700'
                    }`}>{data.plan}</span>
                  </div>
                )}
                {data.activityLevel && (
                  <div className="flex items-center px-4 py-3 gap-3">
                    <span className="text-xs text-stone-500 w-24 flex-shrink-0">活動レベル</span>
                    <span className="text-sm font-bold text-stone-900">{data.activityLevel}</span>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

type ColorKey = 'sky' | 'emerald' | 'orange' | 'rose' | 'amber';

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: ColorKey;
}) {
  const bg: Record<ColorKey, string> = {
    sky: 'bg-sky-50 border-sky-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    orange: 'bg-orange-50 border-orange-200',
    rose: 'bg-rose-50 border-rose-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const text: Record<ColorKey, string> = {
    sky: 'text-sky-700',
    emerald: 'text-emerald-700',
    orange: 'text-orange-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
  };
  return (
    <div className={`border rounded-xl px-3 py-3 ${bg[color]}`}>
      <div className="text-[11px] text-stone-600 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${text[color]}`}>{value}</span>
        <span className="text-xs text-stone-500">{unit}</span>
      </div>
    </div>
  );
}
