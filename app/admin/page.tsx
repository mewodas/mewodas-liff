'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Circle, ChevronRight, UserPlus, ClipboardCopy, Check, AlertTriangle, Trash2 } from 'lucide-react';
import AdminShell from './AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';

type SeatInfo = {
  seatLimit: number | null;
  currentSeats: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
};

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  storeId: string | null;
  createdTime: string | null;
};

type Store = { pageId: string; storeId: string; name: string };

const STALE_DAYS = 14;
const STATUSES = ['すべて', '設定中', '進行中', '休止中', '卒業'];

function isStale(c: Customer): boolean {
  if (c.foodStatus !== '設定中' || c.lineUserId) return false;
  if (!c.createdTime) return false;
  return Date.now() - new Date(c.createdTime).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function SavedSnackbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('saved') === '1') {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        router.replace(window.location.pathname);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-lg inline-flex items-center gap-3">
      <span>✅ 保存しました</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          router.replace(window.location.pathname);
        }}
        className="text-white/80 hover:text-white text-xs font-bold leading-none"
      >
        閉じる
      </button>
    </div>
  );
}

export default function AdminCustomersPage() {
  const base = useAdminBase();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('すべて');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [stores, setStores] = useState<Store[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const [cRes, sRes, bRes] = await Promise.all([
        fetch('/api/admin/customers', { cache: 'no-store' }),
        fetch('/api/admin/stores', { cache: 'no-store' }),
        fetch('/api/admin/billing/info', { cache: 'no-store' }),
      ]);
      if (!cRes.ok) throw new Error(`取得失敗（${cRes.status}）`);
      const cJ = await cRes.json();
      const sJ = sRes.ok ? await sRes.json() : { stores: [] };
      const bJ = bRes.ok ? await bRes.json() : null;
      setCustomers(cJ.customers || []);
      setStores(sJ.stores || []);
      if (bJ && !bJ.error) {
        setSeatInfo({
          seatLimit: bJ.seatLimit,
          currentSeats: bJ.currentSeats,
          isOverLimit: bJ.isOverLimit,
          isNearLimit: bJ.isNearLimit,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const staleCount = useMemo(() => customers.filter(isStale).length, [customers]);

  const filtered = useMemo(() => {
    const qn = q.trim();
    return customers.filter((c) => {
      if (statusFilter !== 'すべて' && c.foodStatus !== statusFilter) return false;
      if (storeFilter && c.storeId !== storeFilter) return false;
      if (qn && !c.name.includes(qn)) return false;
      return true;
    });
  }, [customers, q, statusFilter, storeFilter]);

  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) m.set(s.storeId, s.name);
    return m;
  }, [stores]);

  async function copyInviteLink(e: React.MouseEvent, customerId: string) {
    e.preventDefault();
    e.stopPropagation();
    setCopyingId(customerId);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/invite-link`, { method: 'POST' });
      if (!res.ok) throw new Error('リンク生成失敗');
      const j = await res.json();
      await navigator.clipboard.writeText(j.shareText || j.url);
      showToast('招待リンク（案内文付き）をコピーしました');
    } catch {
      showToast('コピーに失敗しました');
    } finally {
      setCopyingId(null);
    }
  }

  async function bulkCleanup() {
    if (staleCount === 0) return;
    const ok = window.confirm(
      `${staleCount}名の「設定中」顧客（14日以上未起動）を削除します。よろしいですか？\n\n対象: ${customers
        .filter(isStale)
        .map((c) => c.name)
        .join('、')}`
    );
    if (!ok) return;
    setCleaning(true);
    try {
      const res = await fetch('/api/admin/customers/bulk-cleanup', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '削除失敗');
      showToast(`${j.deleted}名削除しました`);
      await loadCustomers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setCleaning(false);
    }
  }

  return (
    <AdminShell title={`顧客一覧（${customers.length}名）`}>
      <Suspense>
        <SavedSnackbar />
      </Suspense>

      <div className="space-y-3">
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.4} />
            {toastMsg}
          </div>
        )}

        {/* 席数上限バナー */}
        {seatInfo?.isOverLimit && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-xl inline-flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" strokeWidth={2.2} />
            <div className="flex-1">
              <div className="font-bold">
                契約席数 {seatInfo.seatLimit}名 / 使用 {seatInfo.currentSeats}名 — 上限到達
              </div>
              <div>新規招待には増枠が必要です。</div>
              <Link href={`${base}/billing`} className="text-rose-700 font-bold underline mt-1 inline-block">
                プランを変更する →
              </Link>
            </div>
          </div>
        )}

        {/* 残り1席バナー */}
        {!seatInfo?.isOverLimit && seatInfo?.isNearLimit && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl inline-flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2.2} />
            <div>
              あと1名で席数上限です。早めの増枠をご検討ください。
              <Link href={`${base}/billing`} className="text-amber-800 font-bold underline ml-1">
                プランを確認する →
              </Link>
            </div>
          </div>
        )}

        {/* 14日経過バナー */}
        {staleCount > 0 && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2.2} />
            <div className="flex-1 min-w-0">
              <div className="font-bold">
                14日以上未起動の顧客が {staleCount} 名います。
              </div>
              <div className="mt-0.5 text-[11px]">
                毎日 03:00 (JST) に自動削除されます。今すぐ手動でクリーンアップする場合は下のボタンから。
              </div>
              <button
                type="button"
                onClick={bulkCleanup}
                disabled={cleaning}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold bg-rose-600 text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2.4} />
                {cleaning ? '削除中…' : `今すぐ一括削除（${staleCount}名）`}
              </button>
            </div>
          </div>
        )}

        <Link
          href={`${base}/customers/new`}
          className="block w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 inline-flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" strokeWidth={2.4} />
          新規顧客追加
        </Link>

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
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">該当する顧客がいません</div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {filtered.map((c) => (
              <li key={c.pageId}>
                <Link
                  href={`${base}/customers/${c.pageId}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-bold text-stone-900 truncate">{c.name}</div>
                      <StatusBadge status={c.foodStatus} />
                      {c.storeId && storeNameById.get(c.storeId) && stores.length > 1 && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                          {storeNameById.get(c.storeId)}
                        </span>
                      )}
                      {isStale(c) && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-full">
                          14日超
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-600 mt-0.5 truncate">
                      {c.currentWeight !== null ? `開始 ${c.currentWeight}kg` : '体重未登録'}
                      {c.targetWeight !== null ? ` → 目標 ${c.targetWeight}kg` : ''}
                      {c.goals.kcal > 0 ? ` ・ 目標 ${c.goals.kcal}kcal/日` : ''}
                    </div>
                    <div className="mt-1.5 flex gap-2 flex-wrap">
                      {!c.lineUserId ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => copyInviteLink(e, c.pageId)}
                            disabled={copyingId === c.pageId || !!seatInfo?.isOverLimit}
                            className="text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-300 px-2.5 py-1 rounded-lg active:bg-sky-200 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <ClipboardCopy className="w-3 h-3" strokeWidth={2.4} />
                            {copyingId === c.pageId ? 'コピー中…' : '招待リンクをコピー'}
                          </button>
                          {seatInfo?.isOverLimit && (
                            <span className="text-[10px] text-rose-600 font-bold inline-flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" strokeWidth={2.2} />
                              席数上限のため招待停止中
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Check className="w-3 h-3" strokeWidth={2.4} />
                          LINE 連携済み
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0 mt-1" strokeWidth={2.2} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
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
      : status === '設定中'
      ? 'bg-violet-100 text-violet-700 border-violet-300'
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
