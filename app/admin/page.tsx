'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Circle, ChevronRight } from 'lucide-react';
import AdminShell from './AdminShell';

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
};

const STATUSES = ['すべて', '進行中', '休止中', '卒業'];

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('すべて');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setCustomers(j.customers || []);
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
      if (qn && !c.name.includes(qn)) return false;
      return true;
    });
  }, [customers, q, statusFilter]);

  return (
    <AdminShell title={`顧客一覧（${customers.length}名）`}>
      <div className="space-y-3">
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
          <div className="flex gap-2 mt-3 overflow-x-auto">
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
                  href={`/admin/customers/${c.pageId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-stone-900 truncate">{c.name}</div>
                      <StatusBadge status={c.foodStatus} />
                    </div>
                    <div className="text-[11px] text-stone-600 mt-0.5 truncate">
                      {c.currentWeight !== null ? `現在 ${c.currentWeight}kg` : '体重未登録'}
                      {c.targetWeight !== null ? ` → 目標 ${c.targetWeight}kg` : ''}
                      {c.goals.kcal > 0 ? ` ・ 目標 ${c.goals.kcal}kcal/日` : ''}
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
