'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Scale,
  ClipboardList,
  Save,
  Calendar as CalendarIcon,
  Send,
  Sparkles,
  Calculator,
  ArrowRight,
  Hourglass,
  UtensilsCrossed,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AdminShell from '../../AdminShell';
import { ACTIVITY_LEVELS, PLANS, calcGoals, daysUntil } from '@/lib/goalCalc';
import { useAdminBase } from '@/lib/useAdminBase';

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  gender: string | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: string | null;
  plan: string | null;
  storeId: string | null;
};

type Store = { pageId: string; storeId: string; name: string };
type Notification = {
  id: string;
  category: string;
  title: string;
  body: string;
  staffName: string;
  read: boolean;
  createdAt: string;
};

const STATUS_OPTIONS = ['進行中', '設定中', '休止中', '卒業'];
const GENDER_OPTIONS = ['男性', '女性'];

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const base = useAdminBase();
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

  // 計算機用基礎情報
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [plan, setPlan] = useState('');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const today = jstToday();

  useEffect(() => {
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setStores(j?.stores || []))
      .catch(() => {});
  }, []);

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
        setGender(c.gender || '');
        setHeightCm(c.heightCm !== null ? String(c.heightCm) : '');
        setAge(c.age !== null ? String(c.age) : '');
        setActivityLevel(c.activityLevel || '');
        setPlan(c.plan || '');
        setStoreId(c.storeId || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ライブ計算
  const calc = useMemo(() => {
    if (!customer) return null;
    return calcGoals({
      gender: gender || null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      age: age ? parseInt(age, 10) : null,
      activityLevel: activityLevel || null,
      plan: plan || null,
      currentWeight: customer.currentWeight,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      targetDate: targetDate || null,
      today,
    });
  }, [customer, gender, heightCm, age, activityLevel, plan, targetWeight, targetDate, today]);

  const remainingDays = useMemo(() => {
    if (!targetDate) return null;
    return daysUntil(targetDate, today);
  }, [targetDate, today]);

  function applyCalc() {
    if (!calc) return;
    setGoalKcal(String(calc.goalKcal));
    setGoalP(String(calc.goalP));
    setGoalF(String(calc.goalF));
    setGoalC(String(calc.goalC));
  }

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
        gender: gender || null,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        age: age ? parseInt(age, 10) : null,
        activityLevel: activityLevel || null,
        plan: plan || null,
        storeId: storeId || null,
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
    <AdminShell title={customer?.name || '顧客詳細'} back={{ href: base }}>
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
            <div className="mt-3">
              <label className="text-xs font-bold text-stone-700 mb-1 block">所属店舗</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>{s.name}</option>
                ))}
              </select>
            </div>
          </section>

          {/* 体型・代謝の基礎情報（計算機の入力） */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              体型・代謝
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">性別</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <NumberInput label="身長 (cm)" value={heightCm} onChange={setHeightCm} step="0.1" />
              <NumberInput label="年齢" value={age} onChange={setAge} step="1" />
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">活動レベル</label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {ACTIVITY_LEVELS.map((a) => (
                    <option key={a.label} value={a.label}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 目標 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              目標
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
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
                <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
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
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">プラン</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 残日数バナー */}
            {targetDate && remainingDays !== null && (
              <div className={`mt-3 rounded-xl border p-3 flex items-center gap-2 ${
                remainingDays < 0
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : remainingDays === 0
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-sky-50 border-sky-200 text-sky-800'
              }`}>
                <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                <div className="text-sm font-bold">
                  {remainingDays < 0 ? `目標日を ${Math.abs(remainingDays)} 日超過` :
                   remainingDays === 0 ? '目標日は今日' :
                   `目標日まであと ${remainingDays} 日`}
                </div>
                {customer.currentWeight !== null && targetWeight && (
                  <div className="ml-auto text-[11px] opacity-80">
                    体重差 {(parseFloat(targetWeight) - customer.currentWeight).toFixed(1)} kg
                  </div>
                )}
              </div>
            )}

            {/* 計算機プレビュー */}
            {calc ? (
              <div className="mt-3 bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-violet-800 inline-flex items-center gap-1">
                    <Calculator className="w-3 h-3" strokeWidth={2.4} />
                    自動計算プレビュー
                  </div>
                  <div className="text-[10px] text-violet-700">
                    BMR {calc.bmr} ・ TDEE {calc.tdee} kcal
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <PreviewStat label="kcal" value={calc.goalKcal} />
                  <PreviewStat label="P (g)" value={calc.goalP} />
                  <PreviewStat label="F (g)" value={calc.goalF} />
                  <PreviewStat label="C (g)" value={calc.goalC} />
                </div>
                {calc.dailyDeltaKcal !== 0 && (
                  <div className="text-[10px] text-violet-700">
                    {calc.clampedDelta < 0 ? '減量' : '増量'}: 1日 {Math.abs(calc.clampedDelta)} kcal {calc.clampedDelta < 0 ? '不足' : '余剰'}
                  </div>
                )}
                {calc.notes.length > 0 && (
                  <ul className="text-[10px] text-amber-700 space-y-0.5">
                    {calc.notes.map((n, i) => (
                      <li key={i}>※ {n}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={applyCalc}
                  className="w-full bg-violet-600 text-white text-xs font-bold py-2 rounded-xl active:bg-violet-700 inline-flex items-center justify-center gap-1"
                >
                  目標値に反映 <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl p-3 text-[11px] text-stone-600">
                <Calculator className="w-3 h-3 inline mr-1" strokeWidth={2.4} />
                身長・年齢・現在体重を入力すると自動計算します
              </div>
            )}

            {/* 目標値（編集可・最終的に保存される値） */}
            <div className="mt-3">
              <div className="text-[10px] font-bold text-stone-700 mb-1">目標値（編集可）</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <NumberInput label="kcal" value={goalKcal} onChange={setGoalKcal} />
                <NumberInput label="P (g)" value={goalP} onChange={setGoalP} step="0.1" />
                <NumberInput label="F (g)" value={goalF} onChange={setGoalF} step="0.1" />
                <NumberInput label="C (g)" value={goalC} onChange={setGoalC} step="0.1" />
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
              href={`${base}/reports?customerId=${id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 active:bg-stone-100"
            >
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                <span className="text-sm font-bold text-stone-900">レポートを送る</span>
              </div>
              <span className="text-stone-400">›</span>
            </Link>
            <Link
              href={`${base}/analysis?customerId=${id}`}
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

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-violet-200 rounded-lg p-1.5 text-center">
      <div className="text-[9px] font-bold text-violet-700">{label}</div>
      <div className="text-sm font-bold text-violet-900">{value}</div>
    </div>
  );
}
