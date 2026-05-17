'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  UserPlus,
  Save,
  Target,
  ClipboardList,
  Calculator,
  Hourglass,
  Calendar as CalendarIcon,
} from 'lucide-react';
import AdminShell from '../../AdminShell';
import { ACTIVITY_LEVELS, calcGoals, daysUntil } from '@/lib/goalCalc';
import { useAdminBase } from '@/lib/useAdminBase';

type StoreItem = { pageId: string; storeId: string; name: string };

const STATUS_OPTIONS = ['設定中', '進行中', '休止中', '卒業'];
const GENDER_OPTIONS = ['男性', '女性'];

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const base = useAdminBase();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
  const today = jstToday();

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [name, setName] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [foodStatus, setFoodStatus] = useState('設定中');
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
        const list: StoreItem[] = j?.stores || [];
        setStores(list);
        if (list.length === 1) setStoreId(list[0].storeId);
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!calc) return;
    setGoalKcal(String(calc.goalKcal));
    setGoalP(String(calc.goalP));
    setGoalF(String(calc.goalF));
    setGoalC(String(calc.goalC));
  }, [calc]);

  const pRatio = useMemo(() => {
    const k = parseFloat(goalKcal);
    const p = parseFloat(goalP);
    if (!k || k === 0) return null;
    return Math.round((p * 4 / k) * 100);
  }, [goalKcal, goalP]);

  const fRatioCalc = useMemo(() => {
    const k = parseFloat(goalKcal);
    const f = parseFloat(goalF);
    if (!k || k === 0) return null;
    return Math.round((f * 9 / k) * 100);
  }, [goalKcal, goalF]);

  const cRatio = useMemo(() => {
    const k = parseFloat(goalKcal);
    const c = parseFloat(goalC);
    if (!k || k === 0) return null;
    return Math.round((c * 4 / k) * 100);
  }, [goalKcal, goalC]);

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
      router.push(`${base}?saved=1`);
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
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
            基本情報
          </h2>
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              氏名（必須）
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 花子"
              className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                ステータス
              </label>
              <select
                value={foodStatus}
                onChange={(e) => setFoodStatus(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                所属店舗
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {stores.map((s) => <option key={s.storeId} value={s.storeId}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              LINEユーザーID
            </label>
            <input
              type="text"
              value={lineUserId}
              onChange={(e) => isAdminRoute && setLineUserId(e.target.value)}
              readOnly={!isAdminRoute}
              placeholder="顧客が初回LIFF起動時に自動取得（事前に分かっていれば入力）"
              className={`w-full border rounded-xl p-2.5 text-base focus:outline-none ${
                isAdminRoute
                  ? 'bg-white border-stone-300 focus:ring-2 focus:ring-emerald-500'
                  : 'bg-stone-100 border-stone-200 text-stone-500 cursor-not-allowed'
              }`}
            />
            <div className="text-xs text-stone-500 mt-0.5">
              {isAdminRoute
                ? '通常は空のまま保存。顧客が LIFF を起動すれば自動で紐付け'
                : 'LINEユーザーIDは顧客が LIFF を起動すると自動紐付けされます（編集不可）'}
            </div>
          </div>
        </section>

        {/* 身体情報 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
            身体情報
          </h2>
          {/* 1段目: 性別 / 年齢 / 身長 / 現在体重 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                性別
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <NumInput label="年齢" value={age} onChange={setAge} step="1" />
            <NumInput label="身長(cm)" value={heightCm} onChange={setHeightCm} step="0.1" />
            <NumInput label="現在体重(kg)" value={currentWeight} onChange={setCurrentWeight} step="0.1" />
          </div>
          {/* 2段目: 活動レベル / 希望のプラン */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                活動レベル
              </label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {ACTIVITY_LEVELS.map((a) => <option key={a.label} value={a.label}>{a.displayLabel}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                希望のプラン
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                <option value="減量">減量</option>
                <option value="増量">増量</option>
                <option value="筋肥大">筋肥大</option>
                <option value="現状維持">現状維持</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-stone-500 leading-snug">
            ※ 性別・年齢・身長・現在体重・活動レベル・希望のプランを入力すると、目標カロリーとPFCが自動計算されます（手動編集可）。
          </div>
        </section>

        {/* 目標 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            目標
          </h2>

          {/* 目標体重・目標達成日 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                目標体重 (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                目標達成日
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {targetDate && remainingDays !== null && (
            <div className="rounded-xl border bg-sky-50 border-sky-200 text-sky-800 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Hourglass className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                <span className="text-sm font-bold">
                  {remainingDays < 0 ? `目標日を ${Math.abs(remainingDays)} 日超過`
                   : remainingDays === 0 ? '目標日は今日'
                   : `目標まであと ${remainingDays} 日`}
                </span>
              </div>
              {currentWeight && targetWeight && (() => {
                const cw = parseFloat(currentWeight);
                const tw = parseFloat(targetWeight);
                if (isNaN(cw) || isNaN(tw)) return null;
                const diff = tw - cw;
                const weightLabel = diff < 0
                  ? `あと ${Math.abs(diff).toFixed(1)}kg 減量`
                  : diff > 0
                  ? `あと ${diff.toFixed(1)}kg 増量`
                  : '現体重キープ';
                const rawDelta = calc?.dailyDeltaKcal;
                const isUnsafeDeficit = calc?.isUnsafeDeficit ?? false;
                const isUnsafeSurplus = calc?.isUnsafeSurplus ?? false;
                const isUnsafeGoalKcal = calc?.isUnsafeGoalKcal ?? false;
                const absDiff = Math.abs(diff);
                return (
                  <div className="space-y-0.5 pl-6">
                    <div className="text-xs font-bold">
                      {weightLabel}
                      {rawDelta !== undefined && rawDelta !== 0 && (
                        <span className="ml-2">
                          {rawDelta < 0 ? `／ 1日あたり ${rawDelta} kcal 削減` : `／ 1日あたり +${rawDelta} kcal 追加`}
                        </span>
                      )}
                    </div>
                    {rawDelta !== undefined && Math.abs(rawDelta) > 0 && remainingDays > 0 && diff !== 0 && (
                      <div className="text-[10px] opacity-70">
                        ({absDiff.toFixed(1)}kg × 7,700 ÷ {remainingDays}日 = {Math.round(rawDelta)} kcal/日)
                      </div>
                    )}
                    {(isUnsafeDeficit || isUnsafeSurplus || isUnsafeGoalKcal) && (
                      <div className="mt-1 text-[11px] text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 leading-snug space-y-0.5">
                        <div className="font-bold">⚠️ 健康上の安全範囲を超えています</div>
                        {isUnsafeDeficit && (
                          <div>・1日あたり {Math.round(rawDelta ?? 0)} kcal の{rawDelta && rawDelta < 0 ? '削減' : '追加'}は、安全上限（±1,000 kcal/日）を超えています</div>
                        )}
                        {isUnsafeSurplus && (
                          <div>・1日あたり +{Math.round(rawDelta ?? 0)} kcal の追加は、安全上限（+1,000 kcal/日）を超えています</div>
                        )}
                        {isUnsafeGoalKcal && (
                          <div>・目標カロリーが安全レンジ（1,200〜4,000 kcal）外です</div>
                        )}
                        <div className="opacity-80">過度な減量／増量は筋肉量低下・代謝低下・リバウンドのリスクがあります。可能であれば目標達成日を後ろにずらすか、目標体重を見直してください。トレーナー判断で進める場合はこのまま保存可能です。</div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {(!currentWeight || !targetWeight) && (
                <div className="pl-6 text-[11px] opacity-70">目標体重を入力すると1日あたり kcal が計算されます</div>
              )}
            </div>
          )}

          {/* 目標カロリー・PFC グリッド（2列×4行） */}
          <div>
            <div className="grid grid-cols-2 gap-2">
              {/* 行1: 現在の消費カロリー / 目標カロリー */}
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">現在の消費カロリー (kcal)</label>
                <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center text-stone-700">
                  {calc?.tdee ?? '—'}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標カロリー (kcal)</label>
                <input
                  type="number"
                  step="1"
                  inputMode="decimal"
                  value={goalKcal}
                  onChange={(e) => setGoalKcal(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 行2: 目標タンパク質(g) / 目標タンパク質(%) */}
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={goalP}
                  onChange={(e) => setGoalP(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標タンパク質 (%)</label>
                <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center text-stone-700">
                  {pRatio !== null ? `${pRatio}%` : '—'}
                </div>
              </div>

              {/* 行3: 目標脂質(g) / 目標脂質(%) */}
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={goalF}
                  onChange={(e) => setGoalF(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標脂質 (%)</label>
                <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center text-stone-700">
                  {fRatioCalc !== null ? `${fRatioCalc}%` : '—'}
                </div>
              </div>

              {/* 行4: 目標炭水化物(g) / 目標炭水化物(%) */}
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={goalC}
                  onChange={(e) => setGoalC(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 mb-1 block">目標炭水化物 (%)</label>
                <div className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center text-stone-700">
                  {cRatio !== null ? `${cRatio}%` : '—'}
                </div>
              </div>
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

function NumInput({
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
      <label className="text-xs font-bold text-stone-700 mb-1 block">
        {label}
      </label>
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
