'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import AdminShell from '../AdminShell';

type PlanDef = {
  pageId: string;
  name: string;
  planCode: string;
  kind: '標準' | 'PoC' | 'エンタープライズ';
  supportFee: number;
  perUserPrice: number;
  volumeApplied: boolean;
  minSeats: number;
  billingCycle: '月払い' | '年払い';
  stripeSupportFeePriceId: string | null;
  stripePerUserPriceId: string | null;
  published: boolean;
  active: boolean;
  note: string | null;
};

const KINDS: PlanDef['kind'][] = ['標準', 'PoC', 'エンタープライズ'];
const CYCLES: PlanDef['billingCycle'][] = ['月払い', '年払い'];

const EMPTY_FORM = {
  name: '',
  planCode: '',
  kind: '標準' as PlanDef['kind'],
  supportFee: 5500,
  perUserPrice: 0,
  volumeApplied: false,
  minSeats: 3,
  billingCycle: '月払い' as PlanDef['billingCycle'],
  stripeSupportFeePriceId: '',
  stripePerUserPriceId: '',
  published: false,
  active: true,
  note: '',
};

type FormState = typeof EMPTY_FORM;

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/plans', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setPlans(j.plans || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingCode(null);
    setShowCreateForm(true);
  }

  function startEdit(plan: PlanDef) {
    setForm({
      name: plan.name,
      planCode: plan.planCode,
      kind: plan.kind,
      supportFee: plan.supportFee,
      perUserPrice: plan.perUserPrice,
      volumeApplied: plan.volumeApplied,
      minSeats: plan.minSeats,
      billingCycle: plan.billingCycle,
      stripeSupportFeePriceId: plan.stripeSupportFeePriceId || '',
      stripePerUserPriceId: plan.stripePerUserPriceId || '',
      published: plan.published,
      active: plan.active,
      note: plan.note || '',
    });
    setEditingCode(plan.planCode);
    setShowCreateForm(true);
  }

  function cancelForm() {
    setShowCreateForm(false);
    setEditingCode(null);
    setForm(EMPTY_FORM);
  }

  async function submit() {
    if (!form.name || !form.planCode) {
      setError('プラン名・プランコードは必須');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        stripeSupportFeePriceId: form.stripeSupportFeePriceId || null,
        stripePerUserPriceId: form.stripePerUserPriceId || null,
        note: form.note || null,
      };
      const url = editingCode ? `/api/admin/plans/${editingCode}` : '/api/admin/plans';
      const method = editingCode ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setSaveMsg(editingCode ? '更新しました' : '作成しました');
      setTimeout(() => setSaveMsg(null), 2500);
      cancelForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="プラン管理">
      <div className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl">{error}</div>
        )}
        {saveMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl">{saveMsg}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900">プラン一覧</h2>
          {!showCreateForm && (
            <button
              type="button"
              onClick={startCreate}
              className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full hover:bg-emerald-100 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" strokeWidth={2.4} />
              新規プラン
            </button>
          )}
        </div>

        {showCreateForm && (
          <PlanForm
            form={form}
            setForm={setForm}
            onSubmit={submit}
            onCancel={cancelForm}
            saving={saving}
            isEdit={!!editingCode}
          />
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-8">読み込み中…</div>
        ) : (
          <ul className="space-y-2">
            {plans.map((plan) => (
              <PlanCard
                key={plan.planCode}
                plan={plan}
                onEdit={() => startEdit(plan)}
              />
            ))}
            {plans.length === 0 && (
              <div className="text-center text-stone-500 text-sm py-8 bg-stone-50 rounded-xl border border-stone-200">
                プランが登録されていません
              </div>
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function PlanCard({ plan, onEdit }: { plan: PlanDef; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="bg-white rounded-xl border border-stone-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-stone-900">{plan.name}</span>
          <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{plan.planCode}</span>
          <KindBadge kind={plan.kind} />
          {!plan.active && (
            <span className="text-[10px] font-bold text-stone-500 bg-stone-100 border border-stone-300 px-1.5 py-0.5 rounded-full">無効</span>
          )}
          {plan.published && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">公開</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" strokeWidth={2.2} /> : <ChevronDown className="w-4 h-4 text-stone-400" strokeWidth={2.2} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-stone-50 rounded-lg p-2">
              <div className="text-stone-500 text-[10px] font-bold mb-0.5">サポート費</div>
              <div className="font-bold text-stone-900">¥{plan.supportFee.toLocaleString()}/月</div>
            </div>
            <div className="bg-stone-50 rounded-lg p-2">
              <div className="text-stone-500 text-[10px] font-bold mb-0.5">per-user単価</div>
              <div className="font-bold text-stone-900">
                {plan.volumeApplied ? 'Volume段階制' : `¥${plan.perUserPrice.toLocaleString()}/人/月`}
              </div>
            </div>
            <div className="bg-stone-50 rounded-lg p-2">
              <div className="text-stone-500 text-[10px] font-bold mb-0.5">最低利用可能アカウント数</div>
              <div className="font-bold text-stone-900">{plan.minSeats}名</div>
            </div>
            <div className="bg-stone-50 rounded-lg p-2">
              <div className="text-stone-500 text-[10px] font-bold mb-0.5">請求サイクル</div>
              <div className="font-bold text-stone-900">{plan.billingCycle}</div>
            </div>
          </div>
          {plan.note && (
            <div className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-lg p-2">{plan.note}</div>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="w-full text-xs font-bold text-stone-700 bg-stone-100 border border-stone-200 py-2 rounded-xl hover:bg-stone-200"
          >
            編集
          </button>
        </div>
      )}
    </li>
  );
}

function KindBadge({ kind }: { kind: PlanDef['kind'] }) {
  const cls = kind === '標準'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : kind === 'PoC'
    ? 'text-blue-700 bg-blue-50 border-blue-200'
    : 'text-violet-700 bg-violet-50 border-violet-200';
  return (
    <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${cls}`}>{kind}</span>
  );
}

function PlanForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  isEdit,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3">
      <div className="text-[11px] font-bold text-emerald-800">{isEdit ? 'プランを編集' : '新規プラン作成'}</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="プラン名（必須）">
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </Field>
        <Field label="プランコード（必須・英数字）">
          <input type="text" value={form.planCode} onChange={(e) => set('planCode', e.target.value)} className={`${inputCls} font-mono`} disabled={isEdit} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="種別">
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as PlanDef['kind'])} className={inputCls}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="請求サイクル">
          <select value={form.billingCycle} onChange={(e) => set('billingCycle', e.target.value as PlanDef['billingCycle'])} className={inputCls}>
            {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="サポート費（円/月）">
          <input type="number" value={form.supportFee} onChange={(e) => set('supportFee', Number(e.target.value))} min={0} className={inputCls} />
        </Field>
        <Field label="per-user単価（円/人/月）">
          <input type="number" value={form.perUserPrice} onChange={(e) => set('perUserPrice', Number(e.target.value))} min={0} className={inputCls} disabled={form.volumeApplied} />
        </Field>
        <Field label="最低利用可能アカウント数">
          <input type="number" value={form.minSeats} onChange={(e) => set('minSeats', Number(e.target.value))} min={1} className={inputCls} />
        </Field>
      </div>
      <div className="flex gap-4 text-xs font-bold text-stone-700">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.volumeApplied} onChange={(e) => set('volumeApplied', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
          Volume段階適用（標準プランのみ）
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
          公開（/store/billing に表示）
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
          有効
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stripeサポート費PriceID">
          <input type="text" value={form.stripeSupportFeePriceId} onChange={(e) => set('stripeSupportFeePriceId', e.target.value)} placeholder="price_xxx（空なら env / inline）" className={`${inputCls} font-mono text-[11px]`} />
        </Field>
        <Field label="Stripe per-user PriceID">
          <input type="text" value={form.stripePerUserPriceId} onChange={(e) => set('stripePerUserPriceId', e.target.value)} placeholder="price_xxx（空なら env / inline）" className={`${inputCls} font-mono text-[11px]`} />
        </Field>
      </div>
      <Field label="備考">
        <input type="text" value={form.note} onChange={(e) => set('note', e.target.value)} className={inputCls} />
      </Field>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 bg-emerald-600 text-white font-bold text-xs py-2 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <Save className="w-3.5 h-3.5" strokeWidth={2.4} />
          {saving ? '保存中…' : isEdit ? '更新' : '作成'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white border border-stone-300 text-stone-700 font-bold text-xs px-3 py-2 rounded-xl active:bg-stone-50"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-stone-700 block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
