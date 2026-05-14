'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Scale, ClipboardList, Save, Calendar as CalendarIcon, Send, Sparkles } from 'lucide-react';
import AdminShell from '../../AdminShell';

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

const STATUS_OPTIONS = ['進行中', '休止中', '卒業'];

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [goalKcal, setGoalKcal] = useState('');
  const [goalP, setGoalP] = useState('');
  const [goalF, setGoalF] = useState('');
  const [goalC, setGoalC] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [foodStatus, setFoodStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const c: Customer = j.customer;
        setCustomer(c);
        setGoalKcal(String(c.goals.kcal));
        setGoalP(String(c.goals.P));
        setGoalF(String(c.goals.F));
        setGoalC(String(c.goals.C));
        setTargetWeight(c.targetWeight !== null ? String(c.targetWeight) : '');
        setTargetDate(c.targetDate || '');
        setFoodStatus(c.foodStatus || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const payload = {
        goals: {
          kcal: parseInt(goalKcal, 10) || 0,
          P: parseFloat(goalP) || 0,
          F: parseFloat(goalF) || 0,
          C: parseFloat(goalC) || 0,
        },
        targetWeight: targetWeight ? parseFloat(targetWeight) : null,
        targetDate: targetDate || null,
        foodStatus: foodStatus || null,
      };
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      const j = await res.json();
      setCustomer(j.customer);
      setSaveMsg('保存しました');
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={customer?.name || '顧客詳細'} back={{ href: '/admin' }}>
      {loading ? (
        <div className="text-center text-stone-500 py-10">読み込み中…</div>
      ) : !customer ? (
        <div className="text-center text-stone-500 py-10">{error || '顧客が見つかりません'}</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
          )}
          {saveMsg && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl">{saveMsg}</div>
          )}

          {/* プロフィール */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
              基本情報
            </h2>
            <Field label="氏名" value={customer.name} />
            <Field label="LINE ユーザーID" value={customer.lineUserId || '未設定'} mono />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">ステータス</label>
                <select
                  value={foodStatus}
                  onChange={(e) => setFoodStatus(e.target.value)}
                  className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">未設定</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">現在体重</label>
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm text-stone-900">
                  {customer.currentWeight !== null ? `${customer.currentWeight} kg` : '未登録'}
                </div>
              </div>
            </div>
          </section>

          {/* 目標 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              目標値
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <NumberInput label="kcal" value={goalKcal} onChange={setGoalKcal} />
              <NumberInput label="P (g)" value={goalP} onChange={setGoalP} step="0.1" />
              <NumberInput label="F (g)" value={goalF} onChange={setGoalF} step="0.1" />
              <NumberInput label="C (g)" value={goalC} onChange={setGoalC} step="0.1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.2} />
                  目標体重 (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5 text-stone-600" strokeWidth={2.2} />
                  目標達成日
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full mt-4 bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" strokeWidth={2.2} />
              {saving ? '保存中…' : '変更を保存'}
            </button>
          </section>

          {/* 各種遷移 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            <Link
              href={`/admin/reports?customerId=${id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
            >
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                <span className="text-sm font-bold text-stone-900">レポートを送る</span>
              </div>
              <span className="text-stone-400">›</span>
            </Link>
            <Link
              href={`/admin/analysis?customerId=${id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                <span className="text-sm font-bold text-stone-900">AI 分析を見る</span>
              </div>
              <span className="text-stone-400">›</span>
            </Link>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[6rem,1fr] gap-2 py-1 text-sm">
      <div className="text-stone-600">{label}</div>
      <div className={`text-stone-900 break-all ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = '1',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-stone-700 mb-1 block">{label}</label>
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
