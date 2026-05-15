'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Save, ExternalLink, Mail, Hash, Tag, Store as StoreIcon, Plus, Edit, Trash2, X, MapPin, Phone, User } from 'lucide-react';
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

type Store = {
  pageId: string;
  storeId: string;
  name: string;
  tenantId: string;
  address: string;
  phone: string;
  hours: string;
  manager: string;
  signature: string;
  active: boolean;
};

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
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFormOpen, setStoreFormOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  async function loadStores() {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/stores`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setStores(j.stores || []);
      }
    } catch {
      // 失敗時は空のまま
    }
  }

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
    loadStores();
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

          {/* 店舗管理 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <StoreIcon className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                店舗（{stores.length}件）
              </h2>
              {!storeFormOpen && !editingStoreId && (
                <button
                  type="button"
                  onClick={() => setStoreFormOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full hover:bg-emerald-100 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" strokeWidth={2.4} />
                  店舗追加
                </button>
              )}
            </div>

            {storeFormOpen && tenant && (
              <StoreForm
                tenantPageId={tenant.pageId}
                onCancel={() => setStoreFormOpen(false)}
                onSaved={() => {
                  setStoreFormOpen(false);
                  loadStores();
                }}
              />
            )}

            {stores.length === 0 && !storeFormOpen ? (
              <div className="text-[11px] text-stone-500 text-center py-3 bg-stone-50 rounded-xl border border-stone-200">
                店舗が登録されていません
              </div>
            ) : (
              <ul className="space-y-1.5">
                {stores.map((s) =>
                  editingStoreId === s.pageId ? (
                    <li key={s.pageId}>
                      <StoreForm
                        tenantPageId={tenant!.pageId}
                        initial={s}
                        onCancel={() => setEditingStoreId(null)}
                        onSaved={() => {
                          setEditingStoreId(null);
                          loadStores();
                        }}
                      />
                    </li>
                  ) : (
                    <li key={s.pageId} className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 flex items-start gap-2">
                      <StoreIcon className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-stone-900">{s.name}</span>
                          <span className="text-[10px] font-mono text-stone-500">[{s.storeId}]</span>
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5 space-y-0.5">
                          {s.address && (
                            <div className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" strokeWidth={2.2} />
                              {s.address}
                            </div>
                          )}
                          {s.phone && (
                            <div className="inline-flex items-center gap-1 ml-2">
                              <Phone className="w-3 h-3" strokeWidth={2.2} />
                              {s.phone}
                            </div>
                          )}
                          {s.manager && (
                            <div className="inline-flex items-center gap-1 ml-2">
                              <User className="w-3 h-3" strokeWidth={2.2} />
                              {s.manager}
                            </div>
                          )}
                        </div>
                        {s.signature && (
                          <div className="text-[10px] text-stone-500 mt-0.5 italic truncate">署名: 「{s.signature}」</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingStoreId(s.pageId)}
                        className="text-stone-500 hover:text-stone-900 p-1 flex-shrink-0"
                        aria-label="編集"
                      >
                        <Edit className="w-3.5 h-3.5" strokeWidth={2.2} />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
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

function StoreForm({
  tenantPageId,
  initial,
  onCancel,
  onSaved,
}: {
  tenantPageId: string;
  initial?: Store;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [storeId, setStoreId] = useState(initial?.storeId || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [manager, setManager] = useState(initial?.manager || '');
  const [signature, setSignature] = useState(initial?.signature || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name || !storeId) {
      setError('店舗名・店舗ID 必須');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = initial ? `/api/admin/stores/${initial.pageId}` : `/api/admin/tenants/${tenantPageId}/stores`;
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, storeId, address, phone, manager, signature }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!initial) return;
    if (!confirm(`「${initial.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stores/${initial.pageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`削除失敗（${res.status}）`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-2">
      <div className="text-[11px] font-bold text-emerald-700">{initial ? '店舗を編集' : '新規店舗'}</div>
      {error && <div className="bg-red-100 border border-red-300 text-red-800 text-[11px] p-1.5 rounded-lg">{error}</div>}
      <div className="grid grid-cols-2 gap-1.5">
        <SmallField label="店舗名（必須）" value={name} onChange={setName} />
        <SmallField label="店舗ID（必須・英数字）" value={storeId} onChange={setStoreId} mono />
      </div>
      <SmallField label="住所" value={address} onChange={setAddress} />
      <div className="grid grid-cols-2 gap-1.5">
        <SmallField label="電話番号" value={phone} onChange={setPhone} />
        <SmallField label="担当者" value={manager} onChange={setManager} />
      </div>
      <SmallField label="レポート署名" value={signature} onChange={setSignature} />
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 bg-emerald-600 text-white font-bold text-xs py-1.5 rounded-lg active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <Save className="w-3 h-3" strokeWidth={2.4} />
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white border border-stone-300 text-stone-700 font-bold text-xs px-2.5 py-1.5 rounded-lg active:bg-stone-50"
        >
          <X className="w-3 h-3" strokeWidth={2.4} />
        </button>
        {initial && (
          <button
            type="button"
            onClick={archive}
            disabled={saving}
            className="bg-red-50 border border-red-200 text-red-700 font-bold text-xs px-2.5 py-1.5 rounded-lg active:bg-red-100"
            aria-label="削除"
          >
            <Trash2 className="w-3 h-3" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-[9px] font-bold text-stone-700 block mb-0.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}
