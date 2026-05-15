'use client';

import { useEffect, useState } from 'react';
import { Store as StoreIcon, Plus, Save, X, Trash2, Edit, MapPin, Phone, Clock, User, Pen } from 'lucide-react';
import AdminShell from '../AdminShell';

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

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stores', { cache: 'no-store' });
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setStores(j.stores || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell title={`店舗管理（${stores.length}件）`}>
      <div className="space-y-3">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            新規店舗追加
          </button>
        )}

        {addOpen && (
          <StoreForm
            onCancel={() => setAddOpen(false)}
            onSaved={() => {
              setAddOpen(false);
              load();
            }}
          />
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : stores.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            店舗が登録されていません
          </div>
        ) : (
          <ul className="space-y-2">
            {stores.map((s) =>
              editingId === s.pageId ? (
                <li key={s.pageId}>
                  <StoreForm
                    initial={s}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      load();
                    }}
                  />
                </li>
              ) : (
                <li key={s.pageId} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <StoreIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-stone-900">{s.name}</span>
                        <span className="text-[10px] font-mono text-stone-500">[{s.storeId}]</span>
                      </div>
                      <div className="text-[11px] text-stone-600 mt-1 space-y-0.5">
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
                        <div className="text-[10px] text-stone-500 mt-1 italic">署名: 「{s.signature}」</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(s.pageId)}
                      className="text-stone-500 hover:text-stone-900 p-1"
                      aria-label="編集"
                    >
                      <Edit className="w-4 h-4" strokeWidth={2.2} />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function StoreForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Store;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [storeId, setStoreId] = useState(initial?.storeId || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [hours, setHours] = useState(initial?.hours || '');
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
      const url = initial ? `/api/admin/stores/${initial.pageId}` : '/api/admin/stores';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, storeId, address, phone, hours, manager, signature }),
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
    if (!confirm(`「${initial.name}」をアーカイブ（削除）しますか？`)) return;
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
    <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-4 space-y-2">
      <div className="text-sm font-bold text-emerald-700">{initial ? '店舗を編集' : '新規店舗'}</div>
      {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-lg">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="店舗名（必須）" value={name} onChange={setName} placeholder="メヲダス 五反田店" />
        <Field label="店舗ID（必須、英数字）" value={storeId} onChange={setStoreId} placeholder="gotanda" mono />
      </div>
      <Field label="住所" value={address} onChange={setAddress} placeholder="東京都品川区五反田..." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="電話番号" value={phone} onChange={setPhone} placeholder="03-XXXX-XXXX" />
        <Field label="営業時間" value={hours} onChange={setHours} placeholder="平日 7:00-22:00" />
      </div>
      <Field label="担当者" value={manager} onChange={setManager} placeholder="社長" />
      <Field
        label="レポート署名"
        value={signature}
        onChange={setSignature}
        placeholder="メヲダス 五反田店 代表トレーナー"
        helper="レポート末尾に自動付与される文字列"
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 bg-emerald-500 text-white font-bold text-sm py-2 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <Save className="w-3.5 h-3.5" strokeWidth={2.4} />
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white border border-stone-300 text-stone-700 font-bold text-sm px-3 py-2 rounded-xl active:bg-stone-50"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
        {initial && (
          <button
            type="button"
            onClick={archive}
            disabled={saving}
            className="bg-red-50 border border-red-200 text-red-700 font-bold text-sm px-3 py-2 rounded-xl active:bg-red-100"
            aria-label="削除"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-stone-700 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mono ? 'font-mono' : ''}`}
      />
      {helper && <div className="text-[10px] text-stone-500 mt-0.5">{helper}</div>}
    </div>
  );
}
