'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Edit, Trash2, Check, X, Users, AlertTriangle } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useToast } from '@/components/Toast';

type Staff = { id: string; name: string; shop: string; role: string; active: boolean };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', { cache: 'no-store' });
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setConfigured(!!j.configured);
      setStaff(j.staff || []);
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
    <AdminShell title="スタッフ管理">
      <div className="space-y-3">
        {!configured && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
            <div>
              <div className="font-bold mb-1">スタッフDB が未設定です</div>
              <p className="leading-relaxed">
                Notion でスタッフ用 DB を作成し、環境変数 <code className="font-mono bg-amber-100 px-1 rounded">NOTION_STAFF_DB_ID</code> をセットしてください。
              </p>
              <p className="text-[10px] mt-1 leading-relaxed">
                スキーマ：名前(title) / 店舗(rich_text) / 役職(rich_text) / 有効(checkbox)
              </p>
            </div>
          </div>
        )}

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            登録スタッフ（{staff.length}名）
          </h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!configured}
            className="inline-flex items-center gap-1 bg-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-full active:bg-violet-700 disabled:bg-stone-300"
          >
            <UserPlus className="w-3.5 h-3.5" strokeWidth={2.4} />
            新規追加
          </button>
        </div>

        {addOpen && (
          <StaffEditor
            onCancel={() => setAddOpen(false)}
            onSaved={async () => {
              setAddOpen(false);
              await load();
            }}
          />
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : staff.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            スタッフが登録されていません
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {staff.map((s) =>
              editingId === s.id ? (
                <li key={s.id} className="p-3">
                  <StaffEditor
                    initial={s}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => {
                      setEditingId(null);
                      await load();
                    }}
                    onDeleted={async () => {
                      setEditingId(null);
                      await load();
                    }}
                  />
                </li>
              ) : (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-stone-900 truncate">{s.name}</div>
                    <div className="text-[11px] text-stone-600 truncate">
                      {[s.shop, s.role].filter(Boolean).join(' ・ ') || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(s.id)}
                    className="text-[11px] font-bold text-emerald-700 border border-emerald-500 px-2.5 py-1 rounded-full active:bg-emerald-50 inline-flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" strokeWidth={2.4} />
                    編集
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function StaffEditor({
  initial,
  onCancel,
  onSaved,
  onDeleted,
}: {
  initial?: Staff;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name || '');
  const [shop, setShop] = useState(initial?.shop || '');
  const [role, setRole] = useState(initial?.role || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), shop: shop.trim(), role: role.trim() };
      if (!payload.name) throw new Error('名前は必須です');
      const url = initial ? `/api/admin/staff/${initial.id}` : '/api/admin/staff';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      toast.success(initial ? '保存しました' : '作成しました');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm(`スタッフ「${initial.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`削除失敗（${res.status}）`);
      toast.success('削除しました');
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">名前 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-stone-700 block mb-1">店舗</label>
          <input
            type="text"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="例：五反田店"
            className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-stone-700 block mb-1">役職</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="例：トレーナー"
            className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      {error && <div className="text-xs text-red-700">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1 bg-violet-500 text-white text-xs font-bold py-2 rounded-xl active:bg-violet-700 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
          {saving ? '保存中…' : initial ? '更新' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1 bg-white border border-stone-300 text-stone-700 text-xs font-bold px-3 py-2 rounded-xl active:bg-stone-50"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
          キャンセル
        </button>
        {initial && (
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center justify-center gap-1 bg-white border border-rose-300 text-rose-700 text-xs font-bold px-3 py-2 rounded-xl active:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
            削除
          </button>
        )}
      </div>
    </div>
  );
}
