'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import FooterNav from '@/components/FooterNav';
import { initLiff, getLineProfile } from '@/lib/liff';
import { invalidate } from '@/lib/clientCache';

type FoodItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
};

type MealType = '朝食' | '昼食' | '夕食' | '間食';
type DayLabel = '今日' | '昨日';

const CATEGORIES = ['全て', '主食', '主菜', '副菜', '汁物', '間食', '飲料', '外食', 'コンビニ', '洋食', '中華', 'エスニック', '食材'];

export default function FoodSearchPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全て');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [day, setDay] = useState<DayLabel>('今日');
  const [mealType, setMealType] = useState<MealType>('昼食');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化失敗');
        setReady(true);
      }
    })();
  }, []);

  // 検索のdebounced fetch
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (category !== '全て') params.set('category', category);
      fetch(`/api/food-search?${params}`)
        .then((r) => r.json())
        .then((j) => setResults(j.items || []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query, category]);

  async function handleAdd(item: FoodItem) {
    if (!userId) return;
    setBusy(item.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/record/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          mealType,
          day,
          title: `${item.name}（${item.unit}）`,
          kcal: item.kcal,
          P: item.P,
          F: item.F,
          C: item.C,
          source: 'food_db',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `記録失敗（${res.status}）`);
      }
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      setSuccess(`${item.name} を ${mealType} に記録しました`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setBusy(null);
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, FoodItem[]>();
    for (const item of results) {
      const arr = m.get(item.category) || [];
      arr.push(item);
      m.set(item.category, arr);
    }
    return Array.from(m.entries());
  }, [results]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <header className="bg-emerald-600 text-white px-4 pt-6 pb-4 shadow sticky top-0 z-30">
        <h1 className="text-lg font-bold mb-2">🔍 食品検索</h1>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：鶏むね、おにぎり、味噌汁"
          className="w-full bg-white text-stone-900 placeholder:text-stone-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        />
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
                category === c ? 'bg-white text-emerald-700' : 'bg-emerald-700/60 text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-white border-b border-stone-200 px-4 py-3 sticky top-[140px] z-20">
        <div className="flex gap-2 mb-2">
          {(['今日', '昨日'] as DayLabel[]).map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                day === d ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-700 border border-stone-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['朝食', '昼食', '夕食', '間食'] as MealType[]).map((m) => (
            <button
              key={m}
              onClick={() => setMealType(m)}
              className={`py-1.5 rounded-lg text-xs font-bold ${
                mealType === m ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-700 border border-stone-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs font-medium p-3 rounded-xl">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-medium p-3 rounded-xl">
            ✅ {success}
          </div>
        )}

        {grouped.length === 0 && (
          <p className="text-center text-sm text-stone-500 py-8">該当する食品がありません</p>
        )}

        {grouped.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="text-xs font-bold text-stone-500 mb-2 px-1">{cat}</h2>
            <div className="space-y-2">
              {items.map((item) => {
                const isBusy = busy === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleAdd(item)}
                    disabled={isBusy || !!busy}
                    className="w-full flex items-center justify-between bg-white border border-stone-200 rounded-xl px-3 py-3 active:bg-emerald-50 disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-bold text-stone-900 truncate">{item.name}</div>
                      <div className="text-[10px] text-stone-600 mt-0.5">
                        {item.unit} ・ P{item.P}・F{item.F}・C{item.C}g
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-sm font-bold text-stone-900">{item.kcal}</div>
                      <div className="text-[10px] text-stone-500">kcal</div>
                    </div>
                    <div className="ml-2 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base font-bold">
                      {isBusy ? '…' : '+'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <Link href="/home" className="block text-center text-xs text-stone-500 underline pt-4">
          🏠 ホームに戻る
        </Link>
      </main>

      <FooterNav />
    </div>
  );
}
