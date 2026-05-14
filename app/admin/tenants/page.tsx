'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, ExternalLink, Mail } from 'lucide-react';
import AdminShell from '../AdminShell';

type Tenant = {
  pageId: string;
  name: string;
  tenantId: string;
  plan: string | null;
  customerDbId: string | null;
  foodDbId: string | null;
  liffId: string | null;
  ownerEmail: string | null;
  status: string | null;
  startDate: string | null;
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setTenants(j.tenants || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell title={`テナント（${tenants.length}件）`}>
      <div className="space-y-3">
        <Link
          href="/admin/tenants/new"
          className="block w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          新規テナント作成
        </Link>

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : tenants.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            テナントなし
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {tenants.map((t) => (
              <li key={t.pageId} className="p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-stone-900">{t.name}</span>
                      {t.status && <StatusBadge status={t.status} />}
                      {t.plan && <PlanBadge plan={t.plan} />}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1 font-mono">{t.tenantId}</div>
                    {t.ownerEmail && (
                      <div className="text-[11px] text-stone-600 mt-1 inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" strokeWidth={2.2} />
                        {t.ownerEmail}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {t.customerDbId && (
                        <a
                          href={`https://www.notion.so/${t.customerDbId.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-stone-700 border border-stone-300 px-2 py-0.5 rounded-full hover:bg-stone-50 inline-flex items-center gap-0.5"
                        >
                          顧客DB <ExternalLink className="w-2.5 h-2.5" strokeWidth={2.4} />
                        </a>
                      )}
                      {t.foodDbId && (
                        <a
                          href={`https://www.notion.so/${t.foodDbId.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-stone-700 border border-stone-300 px-2 py-0.5 rounded-full hover:bg-stone-50 inline-flex items-center gap-0.5"
                        >
                          食事DB <ExternalLink className="w-2.5 h-2.5" strokeWidth={2.4} />
                        </a>
                      )}
                      {t.liffId ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          LIFF: {t.liffId.slice(0, 16)}...
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          LIFF ID未設定
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'アクティブ'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : status === '休止'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : status === '解約'
      ? 'bg-stone-200 text-stone-600 border-stone-300'
      : 'bg-sky-100 text-sky-700 border-sky-300';
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cls}`}>{status}</span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-300">
      {plan}
    </span>
  );
}
