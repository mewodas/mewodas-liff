'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Circle, ChevronRight, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';

type ProgressItem = {
  pageId: string;
  name: string;
  storeId: string | null;
  foodStatus: string | null;
  today: {
    intakeKcal: number;
    targetKcal: number;
    mealCount: number;
    mealTarget: number;
  };
  weight: {
    latest: number | null;
    deltaFromYesterday: number | null;
  };
  exercise: {
    todayMinutes: number;
    todayCount: number;
  };
};

type Store = { pageId: string; storeId: string; name: string };

const STATUSES = ['すべて', '進行中', '休止中', '卒業'];

export default function ProgressPage() {
  const base = useAdminBase();
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('進行中');
  const [storeFilter, setStoreFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch('/api/admin/progress', { cache: 'no-store' }),
        fetch('/api/admin/stores', { cache: 'no-store' }),
      ]);
      if (!pRes.ok) throw new Error(`取得失敗（${pRes.status}）`);
      const pJ = await pRes.json();
      const sJ = sRes.ok ? await sRes.json() : { stores: [] };
      setProgress(pJ.progress || []);
      setToday(pJ.today || '');
      setStores(sJ.stores || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const qn = q.trim();
    return progress.filter((p) => {
      if (statusFilter !== 'すべて' && p.foodStatus !== statusFilter) return false;
      if (storeFilter && p.storeId !== storeFilter) return false;
      if (qn && !p.name.includes(qn)) return false;
      return true;
    });
  }, [progress, q, statusFilter, storeFilter]);

  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) m.set(s.storeId, s.name);
    return m;
  }, [stores]);

  const [todayM, todayD] = today ? today.split('-').map(Number) : [0, 0];
  const todayLabel = today ? `${todayM}/${todayD}` : '';

  return (
    <AdminShell title={`進捗管理${todayLabel ? ` — ${todayLabel}` : ''}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-stone-500">
            {!loading && `${filtered.length}名`}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-bold text-stone-600 px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.2} />
            更新
          </button>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" strokeWidth={2.2} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名で検索"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap border ${
                  statusFilter === s
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {stores.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setStoreFilter('')}
                className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap border ${
                  storeFilter === ''
                    ? 'bg-violet-500 text-white border-violet-500'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                全店舗
              </button>
              {stores.map((s) => (
                <button
                  key={s.storeId}
                  type="button"
                  onClick={() => setStoreFilter(s.storeId)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap border ${
                    storeFilter === s.storeId
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…<br /><span className="text-xs">Notion から今日のデータを集計しています</span></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">該当する顧客がいません</div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {filtered.map((item) => (
              <li key={item.pageId}>
                <Link
                  href={`${base}/progress/${item.pageId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <div className="text-sm font-bold text-stone-900">{item.name}</div>
                      <StatusBadge status={item.foodStatus} />
                      {item.storeId && storeNameById.get(item.storeId) && stores.length > 1 && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                          {storeNameById.get(item.storeId)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {/* 食事 */}
                      <div className="bg-emerald-50 rounded-lg px-2 py-1.5">
                        <div className="text-[10px] text-emerald-700 font-bold mb-0.5">今日の食事</div>
                        {item.today.mealCount > 0 ? (
                          <>
                            <div className="font-bold text-stone-900">
                              {item.today.intakeKcal}<span className="text-[10px] font-normal text-stone-500">/{item.today.targetKcal > 0 ? item.today.targetKcal : '—'}kcal</span>
                            </div>
                            <div className="text-[10px] text-stone-600">{item.today.mealCount}食記録</div>
                          </>
                        ) : (
                          <div className="text-stone-400 text-[11px]">未記録</div>
                        )}
                      </div>
                      {/* 体重 */}
                      <div className="bg-sky-50 rounded-lg px-2 py-1.5">
                        <div className="text-[10px] text-sky-700 font-bold mb-0.5">体重</div>
                        {item.weight.latest !== null ? (
                          <>
                            <div className="font-bold text-stone-900">{item.weight.latest}<span className="text-[10px] font-normal text-stone-500">kg</span></div>
                            <WeightDelta delta={item.weight.deltaFromYesterday} />
                          </>
                        ) : (
                          <div className="text-stone-400 text-[11px]">未記録</div>
                        )}
                      </div>
                      {/* 運動 */}
                      <div className="bg-violet-50 rounded-lg px-2 py-1.5">
                        <div className="text-[10px] text-violet-700 font-bold mb-0.5">運動</div>
                        {item.exercise.todayCount > 0 ? (
                          <>
                            <div className="font-bold text-stone-900">{item.exercise.todayMinutes}<span className="text-[10px] font-normal text-stone-500">分</span></div>
                            <div className="text-[10px] text-stone-600">{item.exercise.todayCount}件</div>
                          </>
                        ) : (
                          <div className="text-stone-400 text-[11px]">0分</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function WeightDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <div className="text-[10px] text-stone-400">前日比 —</div>;
  if (delta < 0) {
    return (
      <div className="text-[10px] text-sky-600 font-bold inline-flex items-center gap-0.5">
        <TrendingDown className="w-3 h-3" strokeWidth={2.4} />
        {delta}kg
      </div>
    );
  }
  if (delta > 0) {
    return (
      <div className="text-[10px] text-rose-500 font-bold inline-flex items-center gap-0.5">
        <TrendingUp className="w-3 h-3" strokeWidth={2.4} />
        +{delta}kg
      </div>
    );
  }
  return (
    <div className="text-[10px] text-stone-500 font-bold inline-flex items-center gap-0.5">
      <Minus className="w-3 h-3" strokeWidth={2.4} />
      変化なし
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-300">
        未設定
      </span>
    );
  }
  const cls =
    status === '進行中'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : status === '休止中'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : status === '卒業'
      ? 'bg-sky-100 text-sky-700 border-sky-300'
      : 'bg-stone-100 text-stone-700 border-stone-300';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cls}`}>
      <Circle className="w-2 h-2 fill-current" strokeWidth={0} />
      {status}
    </span>
  );
}
