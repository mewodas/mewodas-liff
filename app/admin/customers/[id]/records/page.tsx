'use client';

import { use, useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Pencil, Trash2, Save, X } from 'lucide-react';
import AdminShell from '../../../AdminShell';

type FoodRecord = {
  pageId: string;
  mealType: string;
  date: string;
  recordedAt: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  memo: string;
  imageUrl: string | null;
  title: string;
};

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const MEAL_ORDER = ['朝食', '昼食', '夕食', '間食'];

export default function CustomerRecordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [date, setDate] = useState<string>(jstTodayString());
  const [records, setRecords] = useState<FoodRecord[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodRecord | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/customers/${id}/records?date=${encodeURIComponent(date)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        if (cancelled) return;
        setRecords(j.records || []);
        if (j.customer?.name) setCustomerName(j.customer.name);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, date, reload]);

  async function onDelete(record: FoodRecord) {
    if (!confirm(`${record.title || record.memo || '記録'} を削除しますか？`)) return;
    const res = await fetch(`/api/admin/records/${record.pageId}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      alert(`削除失敗：${j?.error || res.status}`);
      return;
    }
    setReload((n) => n + 1);
  }

  const grouped: Record<string, FoodRecord[]> = {};
  for (const m of MEAL_ORDER) grouped[m] = [];
  for (const r of records) {
    const key = MEAL_ORDER.includes(r.mealType) ? r.mealType : '間食';
    grouped[key].push(r);
  }
  const totals = records.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      P: acc.P + r.P,
      F: acc.F + r.F,
      C: acc.C + r.C,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );

  return (
    <AdminShell
      title={customerName ? `${customerName} の食事記録` : '食事記録'}
      back={{ href: `/admin/customers/${id}` }}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-stone-600 flex-shrink-0" strokeWidth={2.2} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="text-right">
            <div className="text-[10px] text-stone-500 font-bold">日合計</div>
            <div className="text-sm font-bold text-stone-900">
              {Math.round(totals.kcal)}<span className="text-[10px] ml-0.5">kcal</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : records.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            この日は記録がありません
          </div>
        ) : (
          <div className="space-y-3">
            {MEAL_ORDER.map((meal) =>
              grouped[meal].length === 0 ? null : (
                <section key={meal} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-stone-50 border-b border-stone-100">
                    <h3 className="text-sm font-bold text-stone-900">{meal}</h3>
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {grouped[meal].map((r) => (
                      <li key={r.pageId} className="flex items-center gap-3 px-3 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-stone-900 truncate">
                            {r.title || r.memo || '食事'}
                          </div>
                          <div className="text-[11px] text-stone-600 mt-0.5 truncate">
                            {Math.round(r.kcal)} kcal ・ P{round1(r.P)}・F{round1(r.F)}・C{round1(r.C)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="flex-shrink-0 text-[11px] font-bold text-emerald-700 border border-emerald-500 px-2.5 py-1 rounded-full active:bg-emerald-50 inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" strokeWidth={2.4} />
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(r)}
                          className="flex-shrink-0 text-[11px] font-medium text-rose-700 border border-rose-300 px-2 py-1 rounded-full active:bg-rose-50 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            )}
          </div>
        )}

        {editing && (
          <EditModal
            record={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setReload((n) => n + 1);
            }}
          />
        )}
      </div>
    </AdminShell>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function EditModal({
  record,
  onClose,
  onSaved,
}: {
  record: FoodRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [memo, setMemo] = useState(record.memo || record.title || '');
  const [P, setP] = useState(String(round1(record.P)));
  const [F, setF] = useState(String(round1(record.F)));
  const [C, setC] = useState(String(round1(record.C)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const calcKcal = Math.round(num(P) * 4 + num(F) * 9 + num(C) * 4);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/records/${record.pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo: memo.trim(),
          P: num(P),
          F: num(F),
          C: num(C),
          kcal: calcKcal,
        }),
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

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center px-4" onClick={saving ? undefined : onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-stone-900">食事を編集</h2>
          <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl mb-3">{error}</div>
        )}
        <label className="text-xs font-bold text-stone-700 mb-1 block">食事名・食材メモ</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
        />
        <div className="grid grid-cols-3 gap-2">
          <NumField label="P (g)" value={P} onChange={setP} />
          <NumField label="F (g)" value={F} onChange={setF} />
          <NumField label="C (g)" value={C} onChange={setC} />
        </div>
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-emerald-700 mb-0.5">自動計算カロリー</div>
          <div className="text-xl font-bold text-emerald-700">
            {calcKcal}
            <span className="text-sm font-medium ml-1">kcal</span>
          </div>
          <p className="text-[10px] text-stone-600 mt-1">P×4 + F×9 + C×4 で算出</p>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full mt-4 bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" strokeWidth={2.2} />
          {saving ? '保存中…' : '変更を保存'}
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-stone-700 mb-1 block">{label}</label>
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
