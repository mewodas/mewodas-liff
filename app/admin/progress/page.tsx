'use client';

import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Circle, ChevronRight, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import AdminShell from '../AdminShell';
import DateRangePicker from '../DateRangePicker';
import { useAdminBase } from '@/lib/useAdminBase';

type ProgressItem = {
  pageId: string;
  name: string;
  lineUserId: string | null;
  storeId: string | null;
  foodStatus: string | null;
  today: {
    intakeKcal: number;
    intakeP: number;
    intakeF: number;
    intakeC: number;
    targetKcal: number;
    targetP: number;
    targetF: number;
    targetC: number;
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

// デモ/サンプル顧客（アカウント数にはカウントしない・一覧には表示する）
const isSampleLineId = (id: string | null) =>
  !!id && (id.startsWith('SAMPLE_') || id.startsWith('DEMO_'));

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function ProgressPage() {
  const base = useAdminBase();
  const router = useRouter();
  const todayStr = jstToday();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('進行中');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [riskMap, setRiskMap] = useState<Map<string, { weightStalled: boolean }>>(new Map());

  const load = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes, rRes] = await Promise.all([
        fetch(`/api/admin/progress?date=${date}`, { cache: 'no-store' }),
        fetch('/api/admin/stores', { cache: 'no-store' }),
        fetch('/api/admin/customers/risk-summary', { cache: 'no-store' }).catch(() => null),
      ]);
      if (!pRes.ok) throw new Error(`取得失敗（${pRes.status}）`);
      const pJ = await pRes.json();
      const sJ = sRes.ok ? await sRes.json() : { stores: [] };
      setProgress(pJ.progress || []);
      setStores(sJ.stores || []);
      // リスク（体重停滞）をステータス横ラベル用に取得。失敗しても本体表示は壊さない
      if (rRes && rRes.ok) {
        const rJ = await rRes.json().catch(() => null);
        const m = new Map<string, { weightStalled: boolean }>();
        for (const r of rJ?.rows || []) {
          m.set(r.customerPageId, { weightStalled: !!r.weightStalled });
        }
        setRiskMap(m);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedDate);
  }, [load, selectedDate]);

  function handleDateChange(newDate: string) {
    if (newDate > todayStr) return;
    setSelectedDate(newDate);
  }

  // DateRangePicker は from=to の単日固定で使う
  function shiftDate(delta: number) {
    const next = addDays(selectedDate, delta);
    if (next > todayStr) return;
    setSelectedDate(next);
  }

  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) m.set(s.storeId, s.name);
    return m;
  }, [stores]);

  // 顧客 select 用リスト（storeFilter + statusFilter 適用後＝一覧と同じ絞り込み。
  // ステータス連動しないとプルダウンに出るのに選ぶと0件になる不整合が起きるため）
  const customerOptions = useMemo(() => {
    return progress.filter((p) => {
      if (statusFilter !== 'すべて' && p.foodStatus !== statusFilter) return false;
      if (storeFilter && p.storeId !== storeFilter) return false;
      return true;
    });
  }, [progress, storeFilter, statusFilter]);

  const filtered = useMemo(() => {
    return progress.filter((p) => {
      if (statusFilter !== 'すべて' && p.foodStatus !== statusFilter) return false;
      if (storeFilter && p.storeId !== storeFilter) return false;
      if (customerId && p.pageId !== customerId) return false;
      return true;
    });
  }, [progress, statusFilter, storeFilter, customerId]);

  // 件数表記用：サンプル/デモ顧客を除いた実顧客数（一覧表示はサンプルも残す）
  const realCount = useMemo(
    () => filtered.filter((p) => !isSampleLineId(p.lineUserId)).length,
    [filtered]
  );

  function handleRowClick(pageId: string) {
    router.push(`${base}/analysis?customer=${pageId}&date=${selectedDate}`);
  }

  return (
    <AdminShell title="進捗管理">
      <div className="space-y-3">
        {/* フィルタバー（食事管理と同じ構成） */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          {/* 日付ナビ — DateRangePicker を単日固定で使用 */}
          <DateRangePicker
            from={selectedDate}
            to={selectedDate}
            today={todayStr}
            onChangeFrom={(v) => handleDateChange(v)}
            onChangeTo={(v) => handleDateChange(v)}
            onShift={shiftDate}
            isSingleDay={true}
          />

          {/* 店舗チップ（読み込み前から「全店舗」を表示） */}
          <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => { setStoreFilter(''); setCustomerId(''); }}
                className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
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
                  onClick={() => { setStoreFilter(s.storeId); setCustomerId(''); }}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                    storeFilter === s.storeId
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

          {/* 顧客 select */}
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">顧客を選択してください</option>
            {customerOptions.map((p) => (
              <option key={p.pageId} value={p.pageId}>
                {p.name}
              </option>
            ))}
          </select>

          {/* status チップ */}
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${
                  statusFilter === s
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-stone-500">
          {!loading && `${realCount}名`}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">該当する顧客がいません</div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {filtered.map((item) => {
              const isSample = !!item.lineUserId && (item.lineUserId.startsWith('SAMPLE_') || item.lineUserId.startsWith('DEMO_'));
              const risk = riskMap.get(item.pageId);
              return (
                <li key={item.pageId}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(item.pageId)}
                    className="w-full block px-4 py-3 hover:bg-stone-50 active:bg-stone-100 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <div className="text-sm font-bold text-stone-900">{item.name}</div>
                      {isSample && (
                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">デモ</span>
                      )}
                      <StatusBadge status={item.foodStatus} />
                      {risk?.weightStalled && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.4} />
                          体重停滞
                        </span>
                      )}
                      {item.storeId && storeNameById.get(item.storeId) && stores.length > 1 && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                          {storeNameById.get(item.storeId)}
                        </span>
                      )}
                    </div>
                    {/* カード行 + 矢印（矢印はカードの中央高さに揃う） */}
                    <div className="flex items-center gap-3">
                      <div className="grid grid-cols-5 gap-2 text-xs flex-1 min-w-0">
                        {/* 食事カード（4/5幅・PFC内訳付き） */}
                        <div className="col-span-4">
                          <MealCard
                            intakeKcal={item.today.intakeKcal}
                            targetKcal={item.today.targetKcal}
                            mealCount={item.today.mealCount}
                            intakeP={item.today.intakeP}
                            intakeF={item.today.intakeF}
                            intakeC={item.today.intakeC}
                            targetP={item.today.targetP}
                            targetF={item.today.targetF}
                            targetC={item.today.targetC}
                          />
                        </div>
                        {/* 体重カード（1/5幅） */}
                        <div className="col-span-1">
                          <WeightCard
                            latest={item.weight.latest}
                            delta={item.weight.deltaFromYesterday}
                          />
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function MealCard({
  intakeKcal,
  targetKcal,
  mealCount,
  intakeP,
  intakeF,
  intakeC,
  targetP,
  targetF,
  targetC,
}: {
  intakeKcal: number;
  targetKcal: number;
  mealCount: number;
  intakeP: number;
  intakeF: number;
  intakeC: number;
  targetP: number;
  targetF: number;
  targetC: number;
}) {
  const pct = targetKcal > 0 ? Math.min(150, Math.round((intakeKcal / targetKcal) * 100)) : null;
  const barColor =
    pct === null ? 'bg-emerald-400'
    : pct < 70 ? 'bg-sky-400'
    : pct <= 115 ? 'bg-emerald-400'
    : pct <= 130 ? 'bg-amber-400'
    : 'bg-rose-400';

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 flex flex-col gap-1 h-full justify-center">
      {mealCount > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-emerald-700">食事</span>
              <span className="text-base font-bold text-stone-900 leading-none">{intakeKcal}</span>
              <span className="text-sm text-stone-500">{targetKcal > 0 ? `/ ${targetKcal} kcal` : 'kcal'}</span>
              {pct !== null && <span className="text-sm font-bold text-stone-600">{pct}%</span>}
            </div>
            <span className="text-[10px] text-stone-500">{mealCount}食記録</span>
          </div>
          {pct !== null && (
            <div className="relative h-1.5 rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full ${barColor} rounded-full`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 text-rose-700 px-1 py-0.5">P <b className="text-rose-800">{Math.round(intakeP)}</b> / {Math.round(targetP)}g</span>
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 text-amber-700 px-1 py-0.5">F <b className="text-amber-800">{Math.round(intakeF)}</b> / {Math.round(targetF)}g</span>
            <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 text-sky-700 px-1 py-0.5">C <b className="text-sky-800">{Math.round(intakeC)}</b> / {Math.round(targetC)}g</span>
          </div>
        </>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-emerald-700">食事</span>
          <span className="text-[11px] text-stone-400">未記録</span>
        </div>
      )}
    </div>
  );
}

function WeightCard({ latest, delta }: { latest: number | null; delta: number | null }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 flex flex-col gap-1 h-full justify-center">
      {latest !== null ? (
        <>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-sky-700">体重</span>
            <span className="text-lg font-bold text-stone-900 leading-none">{latest}</span>
            <span className="text-xs text-stone-500">kg</span>
          </div>
          <WeightDelta delta={delta} />
        </>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-sky-700">体重</span>
          <span className="text-[11px] text-stone-400">未記録</span>
        </div>
      )}
    </div>
  );
}

function WeightDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <div className="text-xs text-stone-400">前日比 —</div>;
  if (delta < 0) {
    return (
      <div className="text-xs text-sky-600 font-bold inline-flex items-center gap-0.5">
        <TrendingDown className="w-3 h-3" strokeWidth={2.4} />
        {delta}kg
      </div>
    );
  }
  if (delta > 0) {
    return (
      <div className="text-xs text-rose-500 font-bold inline-flex items-center gap-0.5">
        <TrendingUp className="w-3 h-3" strokeWidth={2.4} />
        +{delta}kg
      </div>
    );
  }
  return (
    <div className="text-xs text-stone-500 font-bold inline-flex items-center gap-0.5">
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
