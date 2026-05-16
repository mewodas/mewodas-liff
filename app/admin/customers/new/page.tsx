'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Save,
  Target,
  Scale,
  ClipboardList,
  Calculator,
  Hourglass,
  Calendar as CalendarIcon,
} from 'lucide-react';
import AdminShell from '../../AdminShell';
import { ACTIVITY_LEVELS, calcGoals, daysUntil } from '@/lib/goalCalc';
import { useAdminBase } from '@/lib/useAdminBase';

type Store = { pageId: string; storeId: string; name: string };

const STATUS_OPTIONS = ['申込中', '進行中', '休止中', '卒業'];
const GENDER_OPTIONS = ['男性', '女性'];

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const base = useAdminBase();
  const today = jstToday();

  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [foodStatus, setFoodStatus] = useState('申込中');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [plan, setPlan] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [storeId, setStoreId] = useState('');

  const [goalKcal, setGoalKcal] = useState('');
  const [goalP, setGoalP] = useState('');
  const [goalF, setGoalF] = useState('');
  const [goalC, setGoalC] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list: Store[] = j?.stores || [];
        setStores(list);
        if (list.length === 1) setStoreId(list[0].storeId);
      })
      .catch(() => {});
  }, []);

  // ライブ計算
  const calc = useMemo(() => {
    return calcGoals({
      gender: gender || null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      age: age ? parseInt(age, 10) : null,
      activityLevel: activityLevel || null,
      plan: plan || null,
      currentWeight: currentWeight ? parseFloat(currentWeight) : null,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      targetDate: targetDate || null,
      today,
    });
  }, [gender, heightCm, age, activityLevel, plan, currentWeight, targetWeight, targetDate, today]);

  const remainingDays = useMemo(() => {
    if (!targetDate) return null;
    return daysUntil(targetDate, today);
  }, [targetDate, today]);

  // 計算結果が変わったらリアルタイムで目標値に反映（必須項目が揃っているとき）
  useEffect(() => {
    if (!calc) return;
    setGoalKcal(String(calc.goalKcal));
    setGoalP(String(calc.goalP));
    setGoalF(String(calc.goalF));
    setGoalC(String(calc.goalC));
  }, [calc]);

  async function save() {
    if (!name.trim()) {
      setError('氏名は必須です');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        lineUserId: lineUserId.trim() || undefined,
        foodStatus,
        gender: gender || undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        age: age ? parseInt(age, 10) : undefined,
        activityLevel: activityLevel || undefined,
        plan: plan || undefined,
        currentWeight: currentWeight ? parseFloat(currentWeight) : undefined,
        targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
        targetDate: targetDate || undefined,
        goals: (goalKcal || goalP || goalF || goalC)
          ? {
              kcal: parseInt(goalKcal, 10) || 0,
              P: parseFloat(goalP) || 0,
              F: parseFloat(goalF) || 0,
              C: parseFloat(goalC) || 0,
            }
          : undefined,
        storeId: storeId || undefined,
      };
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `作成失敗（${res.status}）`);
      }
      router.push(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="新規顧客追加" back={{ href: base }}>
      <div className="space-y-3">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {/* 基本情報 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
            基本情報
          </h2>
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">氏名（必須）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 花子"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">ステータス</label>
              <select
                value={foodStatus}
                onChange={(e) => setFoodStatus(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">所属店舗</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {stores.map((s) => <option key={s.storeId} value={s.storeId}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">LINEユーザーID（任意）</label>
            <input
              type="text"
              value={lineUserId}
              onChange={(e) => setLineUserId(e.target.value)}
              placeholder="顧客が初回LIFF起動時に自動取得（事前に分かっていれば入力）"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="text-[10px] text-stone-500 mt-0.5">
              通常は空のまま保存。顧客が LIFF を起動すれば自動で紐付け
            </div>
          </div>
        </section>

        {/* 身体プロフィール */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
            身体プロフィール
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
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <NumInput label="年齢" value={age} onChange={setAge} step="1" />
            <NumInput label="身長(cm)" value={heightCm} onChange={setHeightCm} step="0.1" />
            <NumInput label="現在体重(kg)" value={currentWeight} onChange={setCurrentWeight} step="0.1" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-stone-700 mb-1 block">活動レベル</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">—</option>
              {ACTIVITY_LEVELS.map((a) => <option key={a.label} value={a.label}>{a.displayLabel}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-stone-700 mb-1 block">希望のプラン</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">—</option>
              <option value="減量">減量（kcal -500 / P 2.2g/kg・F 20%）</option>
              <option value="増量">増量（kcal +300 / P 2.0g/kg・F 25%）</option>
              <option value="筋肥大">筋肥大（kcal +200 / P 2.5g/kg・F 20%）</option>
              <option value="現状維持">現状維持（kcal ±0 / P 1.6g/kg・F 25%）</option>
            </select>
            <p className="text-[10px] text-stone-500 mt-1 leading-snug">
              ※ 身体プロフィールが揃うと目標カロリー・PFCが自動計算されます
            </p>
          </div>
        </section>

        {/* 目標 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            目標
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          {targetDate && remainingDays !== null && (
            <div className={`rounded-xl border p-3 flex items-center gap-2 ${
              remainingDays < 0 ? 'bg-rose-50 border-rose-200 text-rose-800'
              : remainingDays === 0 ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}>
              <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
              <div className="text-sm font-bold">
                {remainingDays < 0 ? `目標日を ${Math.abs(remainingDays)} 日超過`
                 : remainingDays === 0 ? '目標日は今日'
                 : `目標まであと ${remainingDays} 日`}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold text-stone-700 mb-1">目標カロリー・PFC（自動計算、手動編集可）</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <NumInput label="kcal" value={goalKcal} onChange={setGoalKcal} />
              <NumInput label="P (g)" value={goalP} onChange={setGoalP} step="0.1" />
              <NumInput label="F (g)" value={goalF} onChange={setGoalF} step="0.1" />
              <NumInput label="C (g)" value={goalC} onChange={setGoalC} step="0.1" />
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" strokeWidth={2.2} />
          {saving ? '作成中…' : '顧客を作成'}
        </button>
      </div>
    </AdminShell>
  );
}

function NumInput({ label, value, onChange, step = '1' }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
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

