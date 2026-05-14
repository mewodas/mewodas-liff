'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Send, ChevronRight } from 'lucide-react';
import AdminShell from '../AdminShell';

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
  foodStatus: string | null;
};

export default function AdminReportsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const list: Customer[] = (j.customers || []).filter((c: Customer) => !!c.foodStatus);
        setCustomers(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const qn = q.trim();
    if (!qn) return customers;
    return customers.filter((c) => c.name.includes(qn));
  }, [customers, q]);

  return (
    <AdminShell title="レポート送付">
      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" strokeWidth={2.2} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="顧客名で検索"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl">
          送りたい顧客を選択してレポート・お知らせを作成します。テンプレ・LINEプッシュ通知対応。
        </div>
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}
        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            該当する顧客がいません
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {filtered.map((c) => (
              <li key={c.pageId}>
                <Link
                  href={`/admin/customers/${c.pageId}/notifications`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
                >
                  <Send className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-stone-900 truncate">{c.name}</div>
                    {c.foodStatus && (
                      <div className="text-[11px] text-stone-500 mt-0.5">{c.foodStatus}</div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={2.2} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
