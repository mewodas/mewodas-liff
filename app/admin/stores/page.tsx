'use client';

import { useEffect, useState } from 'react';
import { Store as StoreIcon, Plus, Save, X, Trash2, Edit, ChevronDown } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useToast } from '@/components/Toast';

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
    <AdminShell title={`店舗一覧（${stores.length}件）`}>
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
          <QuickAddForm
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
                  <EditForm
                    initial={s}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      load();
                    }}
                  />
                </li>
              ) : (
                <li key={s.pageId} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 flex items-center gap-3">
                  <StoreIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-stone-900 truncate">{s.name}</div>
                    {s.signature && s.signature !== s.name && (
                      <div className="text-[10px] text-stone-500 mt-0.5 italic truncate">署名: 「{s.signature}」</div>
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
                </li>
              )
            )}
          </ul>
        )}

        <div className="text-[10px] text-stone-500 text-center py-2">
          店舗を追加後、顧客詳細の「所属店舗」から紐付けてください
        </div>
      </div>
    </AdminShell>
  );
}

function QuickAddForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError('店舗名を入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      toast.success('作成しました');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-3 space-y-2">
      <div className="text-sm font-bold text-emerald-700">新規店舗</div>
      {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-lg">{error}</div>}
      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">店舗名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: メヲダス 五反田店"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="text-[10px] text-stone-500 mt-1">
          店舗IDは自動生成、レポート署名は店舗名をそのまま使います（後から編集可）
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex-1 bg-emerald-500 text-white font-bold text-sm py-2 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <Save className="w-3.5 h-3.5" strokeWidth={2.4} />
          {saving ? '保存中…' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white border border-stone-300 text-stone-700 font-bold text-sm px-3 py-2 rounded-xl active:bg-stone-50"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function EditForm({ initial, onCancel, onSaved }: { initial: Store; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [signature, setSignature] = useState(initial.signature);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [manager, setManager] = useState(initial.manager);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError('店舗名必須');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stores/${initial.pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, signature, address, phone, manager }),
      });
      if (!res.ok) throw new Error(`保存失敗（${res.status}）`);
      toast.success('保存しました');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!confirm(`「${initial.name}」を削除しますか？\nこの店舗に紐付いている顧客の所属は外れます。`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stores/${initial.pageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`削除失敗（${res.status}）`);
      toast.success('削除しました');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-3 space-y-2">
      <div className="text-sm font-bold text-emerald-700">店舗を編集</div>
      {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-lg">{error}</div>}
      <Field label="店舗名" value={name} onChange={setName} />
      <Field label="レポート署名" value={signature} onChange={setSignature} helper="レポート末尾に「— {署名}」として自動付与" />

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-[11px] font-bold text-stone-600 inline-flex items-center gap-0.5"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} strokeWidth={2.4} />
        詳細項目（任意）
      </button>
      {showDetails && (
        <div className="space-y-2 pl-1">
          <Field label="住所" value={address} onChange={setAddress} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="電話番号" value={phone} onChange={setPhone} />
            <Field label="担当者" value={manager} onChange={setManager} />
          </div>
        </div>
      )}

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
        <button
          type="button"
          onClick={archive}
          disabled={saving}
          className="bg-red-50 border border-red-200 text-red-700 font-bold text-sm px-3 py-2 rounded-xl active:bg-red-100"
          aria-label="削除"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, helper }: { label: string; value: string; onChange: (v: string) => void; helper?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-stone-700 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {helper && <div className="text-[10px] text-stone-500 mt-0.5">{helper}</div>}
    </div>
  );
}
