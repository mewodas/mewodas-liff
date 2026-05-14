'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Save, ExternalLink, Mail, Hash, Tag } from 'lucide-react';
import AdminShell from '../../AdminShell';

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

const PLANS = ['5-10名', '11-20名', '21名+', 'モニター', '無料'];
const STATUSES = ['アクティブ', '休止', '解約', '商談中'];

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [liffId, setLiffId] = useState('');
  const [plan, setPlan] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const t: Tenant = j.tenant;
        setTenant(t);
        setLiffId(t.liffId || '');
        setPlan(t.plan || '');
        setOwnerEmail(t.ownerEmail || '');
        setStatus(t.status || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save() {
    if (!tenant) return;
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liffId: liffId || null,
          plan,
          ownerEmail,
          status,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      setSaveMsg('保存しました');
      setTimeout(() => setSaveMsg(null), 2500);
      // 再取得
      const refreshed = await fetch(`/api/admin/tenants/${id}`, { cache: 'no-store' }).then((r) => r.json());
      if (refreshed?.tenant) setTenant(refreshed.tenant);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={tenant?.name || 'テナント詳細'} back={{ href: '/admin/tenants' }}>
      {loading ? (
        <div className="text-center text-stone-500 py-10">読み込み中…</div>
      ) : !tenant ? (
        <div className="text-center text-stone-500 py-10">{error || 'テナントが見つかりません'}</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
          )}
          {saveMsg && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl">{saveMsg}</div>
          )}

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
              <h2 className="text-sm font-bold text-stone-900">基本情報</h2>
            </div>
            <Row label="ジム名" value={tenant.name} />
            <Row label="tenant_id" value={tenant.tenantId} mono />
            <Row label="契約開始日" value={tenant.startDate || '-'} />
            <div className="grid grid-cols-2 gap-2 mt-1">
              {tenant.customerDbId && (
                <a
                  href={`https://www.notion.so/${tenant.customerDbId.replace(/-/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50 inline-flex items-center justify-center gap-1"
                >
                  顧客DB <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
                </a>
              )}
              {tenant.foodDbId && (
                <a
                  href={`https://www.notion.so/${tenant.foodDbId.replace(/-/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50 inline-flex items-center justify-center gap-1"
                >
                  食事DB <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
                </a>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              LIFF ID
            </h2>
            <input
              type="text"
              value={liffId}
              onChange={(e) => setLiffId(e.target.value)}
              placeholder="例: 2007123456-AbcDeFgh"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="text-[11px] text-stone-600 bg-violet-50 border border-violet-200 rounded-xl p-2.5">
              ジムが LINE Developers コンソールで発行した LIFF ID。ジムから貰ったらここに入力。
              {liffId && (
                <div className="mt-1">
                  テスト用URL:{' '}
                  <a href={`https://liff.line.me/${liffId}`} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">
                    https://liff.line.me/{liffId}
                  </a>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              契約情報
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">プラン</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {PLANS.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">契約状態</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-stone-600" strokeWidth={2.2} />
                オーナーメール
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </section>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" strokeWidth={2.2} />
            {saving ? '保存中…' : '変更を保存'}
          </button>

          <Link
            href={`/admin/tenants/${tenant.pageId}/edit-in-notion`}
            onClick={(e) => {
              e.preventDefault();
              window.open(`https://www.notion.so/${tenant.pageId.replace(/-/g, '')}`, '_blank');
            }}
            className="block text-center text-xs font-bold text-stone-600 hover:text-stone-900 py-2"
          >
            Notion で開いて編集 →
          </Link>
        </div>
      )}
    </AdminShell>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem,1fr] gap-2 py-0.5 text-sm">
      <div className="text-stone-600">{label}</div>
      <div className={`text-stone-900 break-all ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div>
    </div>
  );
}
