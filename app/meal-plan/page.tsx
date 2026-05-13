'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FooterNav from '@/components/FooterNav';
import PageHeader from '@/components/PageHeader';
import { initLiff, getLineProfile } from '@/lib/liff';
import { loadMyMenu, type MyMenuItem } from '@/lib/myMenu';
import { invalidate } from '@/lib/clientCache';

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatJpDateShort(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${m}/${d}(${wd})`;
}

type Recipe = {
  servings: string;
  time: string;
  ingredients: Array<{ name: string; amount: string }>;
  steps: string[];
  tips: string;
};

type MealItem = {
  type: '朝食' | '昼食' | '夕食' | '間食';
  title: string;
  items: string[];
  kcal: number;
  P: number;
  F: number;
  C: number;
  cookTime: string;
  note: string;
};

type DailyMealPlan = {
  meals: Array<{
    type: '朝食' | '昼食' | '夕食' | '間食';
    title: string;
    items: string[];
    kcal: number;
    P: number;
    F: number;
    C: number;
    cookTime: string;
    note: string;
  }>;
  totals: { kcal: number; P: number; F: number; C: number };
  advice: string;
};

type PlanResponse = {
  plan: DailyMealPlan;
  customerName: string;
  goals: { kcal: number; P: number; F: number; C: number };
  eaten: { kcal: number; P: number; F: number; C: number };
  remaining: { kcal: number; P: number; F: number; C: number };
  exerciseBurn?: number;
  exerciseContent?: string;
  mode: 'full' | 'remaining' | 'one_meal';
  targetMealType?: '朝食' | '昼食' | '夕食' | '間食';
};

const DIET_OPTIONS = ['通常', '高タンパク', '低糖質', '低脂質'];
const BUDGET_OPTIONS = ['節約', '通常', 'こだわり'];
const COOK_OPTIONS = ['時短（15分以内）', '通常', 'じっくり料理'];

// よく使う材料クイック追加（タップでON/OFF）— 厳選10種類
const QUICK_INGREDIENTS = [
  '鶏むね肉', '豚肉', '鮭', '卵', '豆腐',
  '玄米', 'ブロッコリー', 'トマト', 'チーズ', 'アボカド',
];

export default function MealPlanPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-stone-800">読み込み中...</div>
        </main>
      }
    >
      <MealPlanInner />
    </Suspense>
  );
}

function MealPlanInner() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const todayStr = jstTodayString();
  const targetDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dietType, setDietType] = useState('通常');
  const [avoidIngredients, setAvoidIngredients] = useState('');
  const [preferIngredients, setPreferIngredients] = useState('');
  const [budget, setBudget] = useState('通常');
  const [cookTime, setCookTime] = useState('通常');
  const [mode, setMode] = useState<'remaining' | 'full' | 'one_meal'>('one_meal');
  const [oneMealType, setOneMealType] = useState<'朝食' | '昼食' | '夕食' | '間食'>(() => {
    // 現在時刻から食事区分の初期値を自動推定
    const h = new Date().getHours();
    if (h < 10) return '朝食';
    if (h < 15) return '昼食';
    if (h < 17) return '間食';
    return '夕食';
  });
  const [useMyMenu, setUseMyMenu] = useState(false);
  const [myMenu, setMyMenu] = useState<MyMenuItem[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedMyMenuIds, setSelectedMyMenuIds] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [ingredientResults, setIngredientResults] = useState<Array<{
    id: string;
    name: string;
    unit: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipeMeal, setRecipeMeal] = useState<MealItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
        setMyMenu(loadMyMenu());
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化失敗');
        setReady(true);
      }
    })();
  }, []);

  // 材料DB検索（debounced）
  useEffect(() => {
    if (!ingredientSearch.trim()) {
      setIngredientResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/food-search?q=${encodeURIComponent(ingredientSearch)}&limit=15`)
        .then((r) => r.json())
        .then((j) => setIngredientResults(j.items || []))
        .catch(() => setIngredientResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [ingredientSearch]);

  function addIngredient(name: string) {
    const n = name.trim();
    if (!n || ingredients.includes(n)) return;
    if (ingredients.length >= 12) return;
    setIngredients([...ingredients, n]);
    setJustAdded(n);
    window.setTimeout(() => setJustAdded((cur) => (cur === n ? null : cur)), 2000);
  }

  function removeIngredient(name: string) {
    setIngredients(ingredients.filter((i) => i !== name));
  }

  async function handleGenerate() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          dietType,
          avoidIngredients,
          preferIngredients,
          budget,
          cookTime,
          mode,
          oneMealType: mode === 'one_meal' ? oneMealType : undefined,
          ingredients,
          referenceMenu: useMyMenu
            ? selectedMyMenuIds.length > 0
              ? myMenu.filter((m) => selectedMyMenuIds.includes(m.id))
              : myMenu
            : [],
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `献立作成に失敗（${res.status}）`);
      }
      const json: PlanResponse = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '献立作成エラー');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <PageHeader
        title="🍱 AI献立作成"
        subtitle={
          targetDate === todayStr
            ? '今日の献立を提案します'
            : `${formatJpDateShort(targetDate)} の献立を提案します`
        }
        back
      />

      <main className="px-4 py-5 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl">
            {error}
          </div>
        )}

        {!result && (
          <>
            <Section title="どの食事を作る？">
              <div className="grid grid-cols-4 gap-2 mb-3">
                {(['朝食', '昼食', '夕食', '間食'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setOneMealType(m);
                      setMode('one_meal');
                    }}
                    className={`py-3 rounded-xl text-sm font-bold ${
                      mode === 'one_meal' && oneMealType === m
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-700 border border-stone-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMode('full')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold ${
                  mode === 'full'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 border border-stone-300'
                }`}
              >
                📅 1日分まるごと提案（朝・昼・夕・間食を一括）
              </button>
              <p className="text-[11px] text-stone-600 leading-relaxed mt-2">
                {mode === 'one_meal'
                  ? `「${oneMealType}」の献立を、今日の残りPFC・体重目標を考慮して3案提案します。`
                  : '今日の食事記録は考慮せず、1日分（朝・昼・夕・間食）の献立をまるごと提案します。'}
              </p>
            </Section>

            <Section title="マイメニュー参照">
              <label className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  checked={useMyMenu}
                  onChange={(e) => setUseMyMenu(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500"
                />
                <span className="text-sm text-stone-800">
                  マイメニュー（{myMenu.length}件）から優先して提案する
                </span>
              </label>

              {myMenu.length === 0 && (
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  マイメニューが空です。
                  <Link href="/my-menu" className="text-emerald-700 underline ml-1">
                    マイメニューを追加
                  </Link>
                </p>
              )}

              {useMyMenu && myMenu.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-1">
                    <span className="text-[10px] font-bold text-stone-600">
                      使う候補を選択（未選択なら全て対象）
                    </span>
                    {selectedMyMenuIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedMyMenuIds([])}
                        className="text-[10px] text-emerald-700 font-bold underline"
                      >
                        全て解除
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedMyMenuIds(myMenu.map((m) => m.id))}
                        className="text-[10px] text-emerald-700 font-bold underline"
                      >
                        全て選択
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-stone-50 border border-stone-200 rounded-xl p-2">
                    {myMenu.map((m) => {
                      const checked = selectedMyMenuIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${
                            checked ? 'bg-emerald-100 border border-emerald-300' : 'bg-white border border-stone-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedMyMenuIds((cur) =>
                                cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id]
                              );
                            }}
                            className="w-4 h-4 accent-emerald-500 flex-shrink-0"
                          />
                          <span className="flex-1 min-w-0 text-xs font-bold text-stone-900 truncate">
                            {m.name}
                          </span>
                          <span className="text-[10px] text-stone-600 flex-shrink-0">
                            {m.kcal}kcal
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    選択した{selectedMyMenuIds.length || myMenu.length}件をAIに参考として渡します
                  </p>
                </>
              )}
            </Section>

            <Section title={`使う材料を選ぶ（任意・選択中 ${ingredients.length}個）`}>
              {/* 追加直後のトースト */}
              {justAdded && (
                <div className="bg-emerald-500 text-white text-xs font-bold rounded-xl px-3 py-2 mb-2 text-center shadow-md animate-pulse">
                  ✅ 「{justAdded}」を追加しました
                </div>
              )}

              {/* 選択中の材料：常に枠を表示 */}
              <div className={`rounded-xl p-2 mb-2 border ${
                ingredients.length > 0
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-stone-50 border-stone-200 border-dashed'
              }`}>
                {ingredients.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ingredients.map((ing) => {
                      const flash = justAdded === ing;
                      return (
                        <button
                          key={ing}
                          type="button"
                          onClick={() => removeIngredient(ing)}
                          className={`text-[11px] font-bold rounded-full pl-2 pr-1.5 py-1 border transition-colors ${
                            flash
                              ? 'bg-emerald-500 text-white border-emerald-500 ring-2 ring-emerald-300'
                              : 'bg-white text-emerald-700 border-emerald-300 active:bg-emerald-100'
                          }`}
                        >
                          {ing} <span className={flash ? 'text-white ml-0.5' : 'text-emerald-500 ml-0.5'}>×</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-stone-500 text-center py-1">
                    下から材料を選ぶと、ここに表示されます
                  </div>
                )}
              </div>

              {/* 統合検索：食品DB候補＋手入力追加 */}
              <div className="text-[10px] font-bold text-stone-600 mb-1">🔍 材料を検索 / 入力</div>
              <div className="flex gap-1.5 mb-1">
                <input
                  type="text"
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && ingredientSearch.trim()) {
                      e.preventDefault();
                      addIngredient(ingredientSearch);
                      setIngredientSearch('');
                      setIngredientResults([]);
                    }
                  }}
                  placeholder="例：鶏むね、サーモン、おにぎり"
                  className="flex-1 bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!ingredientSearch.trim()) return;
                    addIngredient(ingredientSearch);
                    setIngredientSearch('');
                    setIngredientResults([]);
                  }}
                  disabled={!ingredientSearch.trim()}
                  className="bg-emerald-500 text-white text-xs font-bold px-3 rounded-lg active:bg-emerald-700 disabled:opacity-50"
                >
                  追加
                </button>
              </div>
              <p className="text-[10px] text-stone-500 mb-2">
                入力するとDB候補が出ます。タップで追加／そのまま追加ボタンで自由入力OK
              </p>
              {ingredientResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 mt-1">
                  {ingredientResults.map((r) => {
                    const isSelected = ingredients.includes(r.name);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            removeIngredient(r.name);
                          } else {
                            addIngredient(r.name);
                          }
                          // クリックしたら候補を閉じて検索もクリアし、上の選択中エリアに反映
                          setIngredientSearch('');
                          setIngredientResults([]);
                        }}
                        className={`w-full flex items-center justify-between text-left text-[11px] rounded-lg px-2 py-1.5 border ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-white text-stone-800 border-stone-200 active:bg-emerald-50'
                        }`}
                      >
                        <span>{isSelected ? '✓ ' : '＋ '}{r.name} <span className="text-stone-500 font-normal">{r.unit}</span></span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* よく使う材料（一番下） */}
              <div className="text-[10px] font-bold text-stone-600 mt-3 mb-1">よく使う材料からタップ</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_INGREDIENTS.map((ing) => {
                  const selected = ingredients.includes(ing);
                  return (
                    <button
                      key={ing}
                      type="button"
                      onClick={() => (selected ? removeIngredient(ing) : addIngredient(ing))}
                      className={`text-[11px] font-bold rounded-full px-2 py-1 border ${
                        selected
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white text-stone-700 border-stone-300 active:bg-stone-50'
                      }`}
                    >
                      {selected ? '✓ ' : ''}{ing}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-stone-500 mt-2 leading-relaxed">
                選んだ材料を必ず使う献立を提案します。空欄なら自由に提案します。
              </p>
            </Section>

            <Section title="食事傾向">
              <div className="grid grid-cols-4 gap-2">
                {DIET_OPTIONS.map((opt) => (
                  <Chip key={opt} label={opt} active={dietType === opt} onClick={() => setDietType(opt)} />
                ))}
              </div>
            </Section>

            <Section title="食べたい料理・気分（任意）">
              <input
                type="text"
                value={preferIngredients}
                onChange={(e) => setPreferIngredients(e.target.value)}
                placeholder="例：辛いもの、あっさり、がっつり、韓国料理、鶏肉"
                className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-stone-500 mt-1">気分・テイスト・食材なんでもOK</p>
            </Section>

            <Section title="避けたい食材（任意）">
              <input
                type="text"
                value={avoidIngredients}
                onChange={(e) => setAvoidIngredients(e.target.value)}
                placeholder="例：魚介、ナッツ、乳製品"
                className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-stone-500 mt-1">アレルギーや苦手なものを入力</p>
            </Section>

            <Section title="予算感">
              <div className="grid grid-cols-3 gap-2">
                {BUDGET_OPTIONS.map((opt) => (
                  <Chip key={opt} label={opt} active={budget === opt} onClick={() => setBudget(opt)} />
                ))}
              </div>
            </Section>

            <Section title="調理時間">
              <div className="grid grid-cols-3 gap-2">
                {COOK_OPTIONS.map((opt) => (
                  <Chip key={opt} label={opt} active={cookTime === opt} onClick={() => setCookTime(opt)} />
                ))}
              </div>
            </Section>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-emerald-500 text-white text-lg font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500"
            >
              {loading ? '🤖 献立作成中…' : '✨ 献立を作る'}
            </button>
            {loading && (
              <p className="text-xs text-stone-700 text-center mt-2">
                約10〜20秒かかります。
              </p>
            )}
          </>
        )}

        {result && (
          <>
            {/* 今日の摂取・運動・残りサマリー */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-stone-700 mb-2">📊 今日の状況</div>
              <div className={`grid ${(result.exerciseBurn ?? 0) > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center`}>
                <div className="bg-stone-50 rounded-xl p-2">
                  <div className="text-[10px] text-stone-600">食べた</div>
                  <div className="text-base font-bold text-stone-900">{Math.round(result.eaten.kcal)} kcal</div>
                </div>
                {(result.exerciseBurn ?? 0) > 0 ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-2">
                    <div className="text-[10px] text-orange-700 font-bold">運動消費</div>
                    <div className="text-base font-bold text-orange-700">+{result.exerciseBurn} kcal</div>
                  </div>
                ) : null}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                  <div className="text-[10px] text-emerald-700 font-bold">残り</div>
                  <div className="text-base font-bold text-emerald-700">{Math.round(result.remaining.kcal)} kcal</div>
                </div>
              </div>
              <div className="text-[10px] text-stone-500 mt-2 text-center">
                残りPFC：P{r1(result.remaining.P)}・F{r1(result.remaining.F)}・C{r1(result.remaining.C)}
                {(result.exerciseBurn ?? 0) > 0 ? (
                  <> ・運動分（{result.exerciseBurn}kcal）を残りに加算</>
                ) : null}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-emerald-700 mb-1">
                🍱 {result.mode === 'one_meal'
                  ? `${result.targetMealType || '指定食事'}の${result.plan.meals.length}案（残りPFC考慮）`
                  : result.mode === 'remaining'
                  ? `${result.plan.meals.length}つの献立案（残りPFCに合わせて）`
                  : '1日分の献立'}
              </div>
              <div className="text-[10px] text-stone-600 mb-2">
                ※ PFC・kcal は AI による<strong>参照値</strong>（実際の食材・調理で変動します）
              </div>
              {result.mode === 'remaining' || result.mode === 'one_meal' ? (
                <div className="text-[11px] text-stone-700 text-center">
                  下の各案から好きなものを選んで「この食事にする」で記録できます
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Stat label="kcal" value={`${result.plan.totals.kcal}`} />
                    <Stat label="P (g)" value={`${result.plan.totals.P}`} />
                    <Stat label="F (g)" value={`${result.plan.totals.F}`} />
                    <Stat label="C (g)" value={`${result.plan.totals.C}`} />
                  </div>
                  <div className="text-[10px] text-stone-600 mt-2 text-center">1日合計</div>
                </>
              )}
            </div>

            {result.plan.meals.map((meal, idx) => (
              <div key={`${meal.type}-${idx}`} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-emerald-700">
                    {(result.mode === 'remaining' || result.mode === 'one_meal') ? `案${idx + 1} ・ ` : ''}{meal.type} ・ {meal.cookTime}
                  </div>
                  <div className="text-xs font-bold text-stone-900">
                    {meal.kcal} kcal
                  </div>
                </div>
                <div className="text-base font-bold text-stone-900 mb-2">{meal.title}</div>
                <ul className="text-xs text-stone-700 space-y-1 mb-3 list-disc list-inside">
                  {meal.items.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
                <div className="flex gap-3 text-[11px] text-stone-600 mb-3">
                  <span>P {meal.P}g</span>
                  <span>F {meal.F}g</span>
                  <span>C {meal.C}g</span>
                  <span className="text-stone-400">（参照値）</span>
                </div>
                {meal.note && (
                  <p className="text-[11px] text-stone-500 bg-stone-50 p-2 rounded-lg mb-3">
                    💡 {meal.note}
                  </p>
                )}
                <button
                  onClick={() => setRecipeMeal(meal)}
                  className="w-full bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl active:bg-emerald-700"
                >
                  🍳 この食事にする（作り方を見る）
                </button>
              </div>
            ))}

            {result.plan.advice && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="text-xs font-bold text-amber-800 mb-1">🎯 ポイント</div>
                <p className="text-sm text-stone-800 leading-relaxed">{result.plan.advice}</p>
              </div>
            )}

            <button
              onClick={() => setResult(null)}
              className="w-full bg-stone-200 text-stone-800 font-bold py-3 rounded-xl active:bg-stone-300"
            >
              🔄 もう一度作る
            </button>
            <Link
              href="/home"
              className="block w-full bg-white border border-stone-300 text-stone-900 font-bold py-3 rounded-xl text-center active:bg-stone-50"
            >
              🏠 ホームへ
            </Link>
          </>
        )}
      </main>

      <FooterNav />

      {recipeMeal && userId && (
        <RecipeSheet
          meal={recipeMeal}
          lineUserId={userId}
          targetDate={targetDate}
          onClose={() => setRecipeMeal(null)}
          onRecorded={() => {
            invalidate('today_');
            invalidate('weekly_');
            invalidate('history_');
            setRecipeMeal(null);
          }}
        />
      )}
    </div>
  );
}

function RecipeSheet({
  meal,
  lineUserId,
  targetDate,
  onClose,
  onRecorded,
}: {
  meal: MealItem;
  lineUserId: string;
  targetDate: string;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/meal-plan/recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: meal.title, items: meal.items }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `レシピ取得失敗（${res.status}）`);
        }
        const json = await res.json();
        if (!cancelled) setRecipe(json.recipe);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meal.title, meal.items]);

  async function handleComplete() {
    setRecording(true);
    setError(null);
    try {
      const res = await fetch('/api/record/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          mealType: meal.type,
          date: targetDate,
          title: meal.title,
          kcal: meal.kcal,
          P: meal.P,
          F: meal.F,
          C: meal.C,
          source: 'meal_plan',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `記録失敗（${res.status}）`);
      }
      onRecorded();
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={recording ? undefined : onClose}>
      <div
        className="bg-stone-50 rounded-t-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-stone-50 pt-3 pb-2 border-b border-stone-200 z-10">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900 truncate">🍳 {meal.title}</h2>
            <button onClick={onClose} className="text-stone-500 text-2xl leading-none px-2" disabled={recording}>×</button>
          </div>
          <div className="text-[11px] text-stone-600 px-5 mt-1">
            {formatJpDateShort(targetDate)} の {meal.type} ・ {meal.kcal} kcal ・ P{meal.P}/F{meal.F}/C{meal.C}g
          </div>
        </div>

        <div className="p-4 space-y-4 pb-32">
          {loading && (
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="text-3xl mb-2">🤖</div>
              <div className="text-sm font-bold text-stone-800 mb-1">作り方を生成中…</div>
              <div className="text-xs text-stone-500">約5〜10秒</div>
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
          )}
          {recipe && (
            <>
              <div className="bg-white rounded-2xl p-4 border border-stone-200">
                <div className="flex gap-4 text-xs text-stone-700 mb-2">
                  <span>👤 {recipe.servings}</span>
                  <span>⏱ 約{recipe.time}</span>
                </div>
                <div className="text-sm font-bold text-stone-900 mb-2">材料</div>
                <ul className="text-xs text-stone-800 space-y-1">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex justify-between border-b border-stone-100 last:border-0 py-1">
                      <span>{ing.name}</span>
                      <span className="font-bold text-stone-900">{ing.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-stone-200">
                <div className="text-sm font-bold text-stone-900 mb-2">作り方</div>
                <ol className="space-y-3">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 text-white rounded-full font-bold text-xs flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-stone-800 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {recipe.tips && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="text-xs font-bold text-amber-800 mb-1">💡 コツ・ポイント</div>
                  <p className="text-xs text-stone-800 leading-relaxed">{recipe.tips}</p>
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 border border-stone-200">
                <div className="text-xs font-bold text-stone-700 mb-2">📝 完了したら記録します</div>
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-sm font-bold text-emerald-800 text-center">
                  {formatJpDateShort(targetDate)} の {meal.type}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-50 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleComplete}
              disabled={loading || recording}
              className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-md active:bg-emerald-700 disabled:bg-stone-300"
            >
              {recording ? '記録中…' : `✅ ${formatJpDateShort(targetDate)} の ${meal.type} に記録`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
      <div className="text-sm font-bold text-stone-900 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`py-2 px-2 rounded-xl text-xs font-bold ${
        active ? 'bg-emerald-500 text-white shadow-sm' : 'bg-stone-100 text-stone-700 border border-stone-300'
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-stone-900">{value}</div>
      <div className="text-[10px] text-stone-600">{label}</div>
    </div>
  );
}

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

