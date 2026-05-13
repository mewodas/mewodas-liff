'use client';

import { useEffect, useState } from 'react';
import { initLiff, getLineProfile } from '@/lib/liff';

type Overview = {
  date: string;
  dateLabel: string;
  currentHour: number;
  customers: Array<{
    lineUserId: string;
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
    totals: { kcal: number; P: number; F: number; C: number };
    pct: number;
    mealsRecorded: { 朝食: boolean; 昼食: boolean; 夕食: boolean; 間食: boolean };
    weight: string;
    exercised: boolean;
    exerciseContent: string;
    lastRecordedAt: string | null;
    warnings: string[];
  }>;
  summary: { total: number; warning: number; ok: number };
};

export default function TrainerPage() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
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
        const res = await fetch(
          `/api/trainer/overview?lineUserId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `データ取得失敗（${res.status}）`);
        }
        const json: Overview = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function refresh() {
    setReady(false);
    setError(null);
    try {
      const profile = await getLineProfile();
      if (!profile) throw new Error('プロフィール取得失敗');
      const res = await fetch(
        `/api/trainer/overview?lineUserId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`データ取得失敗（${res.status}）`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setReady(true);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl text-sm">
            {error || 'データなし'}
          </div>
        </div>
      </main>
    );
  }

  const warnings = data.customers.filter((c) => c.warnings.length > 0);
  const ok = data.customers.filter((c) => c.warnings.length === 0);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 pb-10">
      <div className="max-w-md mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">👥 トレーナー俯瞰</h1>
            <p className="text-sm text-stone-700 mt-1">
              {data.dateLabel} ・ {data.currentHour}時時点
            </p>
          </div>
          <button
            onClick={refresh}
            className="bg-white border border-stone-300 text-stone-900 font-bold px-3 py-2 rounded-xl text-sm active:bg-stone-50"
          >
            🔄 更新
          </button>
        </div>

        {/* サマリ */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-stone-600 font-medium">合計</div>
            <div className="text-xl font-bold text-stone-900">{data.summary.total}</div>
          </div>
          <div>
            <div className="text-xs text-rose-700 font-medium">要対応</div>
            <div className="text-xl font-bold text-rose-700">{data.summary.warning}</div>
          </div>
          <div>
            <div className="text-xs text-emerald-700 font-medium">順調</div>
            <div className="text-xl font-bold text-emerald-700">{data.summary.ok}</div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-rose-700 mb-2 px-1">🚨 要対応（{warnings.length}名）</h2>
            <div className="space-y-3">
              {warnings.map((c) => (
                <CustomerCard key={c.lineUserId} c={c} />
              ))}
            </div>
          </div>
        )}

        {ok.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-emerald-700 mb-2 px-1">✅ 順調（{ok.length}名）</h2>
            <div className="space-y-3">
              {ok.map((c) => (
                <CustomerCard key={c.lineUserId} c={c} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CustomerCard({
  c,
}: {
  c: Overview['customers'][number];
}) {
  const hasWarning = c.warnings.length > 0;
  const cardBorder = hasWarning ? 'border-rose-300' : 'border-emerald-300';
  const pctStatus =
    c.pct >= 95 && c.pct <= 105
      ? '✨'
      : c.pct >= 80 && c.pct <= 120
      ? '⭕'
      : c.pct >= 60 && c.pct <= 140
      ? '🔺'
      : '💦';
  const pctColor = c.pct > 120 ? 'text-rose-700' : c.pct < 80 ? 'text-amber-700' : 'text-emerald-700';

  return (
    <div className={`bg-white rounded-2xl shadow-md p-4 border ${cardBorder}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-stone-900 text-base">{c.name}</h3>
        {hasWarning && (
          <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
            {c.warnings.map((w, i) => (
              <span
                key={i}
                className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full whitespace-nowrap"
              >
                ⚠️ {w}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 食事区分 */}
      <div className="flex gap-2 mb-2 text-xs">
        <MealMark label="朝" done={c.mealsRecorded.朝食} />
        <MealMark label="昼" done={c.mealsRecorded.昼食} />
        <MealMark label="夕" done={c.mealsRecorded.夕食} />
        <MealMark label="間" done={c.mealsRecorded.間食} optional />
      </div>

      {/* PFC */}
      <div className="text-sm mb-2">
        <span className={`font-bold ${pctColor}`}>
          📊 {c.totals.kcal} / {c.goals.kcal} kcal ({c.pct}%) {pctStatus}
        </span>
        <div className="text-xs text-stone-600 mt-0.5">
          P {c.totals.P}g ・ F {c.totals.F}g ・ C {c.totals.C}g
        </div>
      </div>

      {/* 体重・運動 */}
      <div className="text-xs text-stone-700 mb-2">
        ⚖️ {c.weight ? `${c.weight} kg` : '未記録'} ・
        {' '}🏃 {c.exercised ? `した${c.exerciseContent ? `（${c.exerciseContent}）` : ''}` : 'なし'}
      </div>

      {/* 最終記録 */}
      {c.lastRecordedAt && (
        <div className="text-[11px] text-stone-500 mb-2">🕐 最終記録 {c.lastRecordedAt}</div>
      )}

      <button
        onClick={() => {
          window.location.href = `/home?lineUserId=${encodeURIComponent(c.lineUserId)}`;
        }}
        className="w-full bg-stone-100 text-stone-900 font-bold py-2 rounded-xl text-sm active:bg-stone-200"
      >
        👀 詳細を見る
      </button>
    </div>
  );
}

function MealMark({ label, done, optional }: { label: string; done: boolean; optional?: boolean }) {
  if (optional && !done) {
    return (
      <span className="font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
        {label}
      </span>
    );
  }
  return (
    <span
      className={`font-bold px-2 py-0.5 rounded-md ${
        done ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'
      }`}
    >
      {label} {done ? '✓' : '✗'}
    </span>
  );
}
