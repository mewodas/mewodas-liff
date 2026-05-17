'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Circle, ChevronRight, UserPlus, ClipboardCopy, Check, CheckCircle } from 'lucide-react';
import AdminShell from './AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';

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
};

type Store = { pageId: string; storeId: string; name: string };

const STATUSES = ['すべて', '設定中', '進行中', '休止中', '卒業'];

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
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch('/api/admin/customers', { cache: 'no-store' }),
          fetch('/api/admin/stores', { cache: 'no-store' }),
        ]);
        if (!cRes.ok) throw new Error(`取得失敗（${cRes.status}）`);
        const cJ = await cRes.json();
        const sJ = sRes.ok ? await sRes.json() : { stores: [] };
        setCustomers(cJ.customers || []);
        setStores(sJ.stores || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  async function approveCustomer(e: React.MouseEvent, customerId: string) {
    e.preventDefault();
    e.stopPropagation();
    setApprovingId(customerId);
    try {
      const patchRes = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodStatus: '進行中' }),
      });
      if (!patchRes.ok) throw new Error('承認失敗');
      setCustomers((prev) =>
        prev.map((c) => (c.pageId === customerId ? { ...c, foodStatus: '進行中' } : c))
      );
      const linkRes = await fetch(`/api/admin/customers/${customerId}/invite-link`, { method: 'POST' });
      if (linkRes.ok) {
        const j = await linkRes.json();
        await navigator.clipboard.writeText(j.shareText || j.url);
        showToast('承認しました 招待リンク（案内文付き）をコピーしました');
      } else {
        showToast('承認しました（リンク生成失敗）');
      }
    } catch {
      showToast('承認に失敗しました');
    } finally {
      setApprovingId(null);
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
                    </div>
                    <div className="text-[11px] text-stone-600 mt-0.5 truncate">
                      {c.currentWeight !== null ? `現在 ${c.currentWeight}kg` : '体重未登録'}
                      {c.targetWeight !== null ? ` → 目標 ${c.targetWeight}kg` : ''}
                      {c.goals.kcal > 0 ? ` ・ 目標 ${c.goals.kcal}kcal/日` : ''}
                    </div>
                    <div className="mt-1.5 flex gap-2 flex-wrap">
                      {c.foodStatus === '設定中' && (
                        <button
                          type="button"
                          onClick={(e) => approveCustomer(e, c.pageId)}
                          disabled={approvingId === c.pageId}
                          className="text-[11px] font-bold bg-emerald-500 text-white px-2.5 py-1 rounded-lg active:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" strokeWidth={2.4} />
                          {approvingId === c.pageId ? '承認中…' : '承認する'}
                        </button>
                      )}
                      {!c.lineUserId ? (
                        <button
                          type="button"
                          onClick={(e) => copyInviteLink(e, c.pageId)}
                          disabled={copyingId === c.pageId}
                          className="text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-300 px-2.5 py-1 rounded-lg active:bg-sky-200 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <ClipboardCopy className="w-3 h-3" strokeWidth={2.4} />
                          {copyingId === c.pageId ? 'コピー中…' : '招待リンクをコピー'}
                        </button>
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
