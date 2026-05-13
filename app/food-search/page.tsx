'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import FooterNav from '@/components/FooterNav';
import PageHeader from '@/components/PageHeader';
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

type CartLine = { item: FoodItem; qty: number };

const CATEGORIES = ['全て', '主食', '主菜', '副菜', '汁物', '間食', '飲料', '外食', 'コンビニ', '洋食', '中華', 'エスニック', '食材'];

export default function FoodSearchPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全て');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [day, setDay] = useState<DayLabel>('今日');
  const [mealType, setMealType] = useState<MealType>('昼食');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  function addToCart(item: FoodItem) {
    setCart((prev) => {
      const cur = prev[item.id];
      return {
        ...prev,
        [item.id]: cur ? { item, qty: cur.qty + 1 } : { item, qty: 1 },
      };
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      if (cur.qty <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  }

  function deleteFromCart(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function clearCart() {
    setCart({});
  }

  async function handleCommit() {
    if (!userId) return;
    const lines = Object.values(cart);
    if (lines.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await Promise.allSettled(
        lines.flatMap(({ item, qty }) =>
          Array.from({ length: qty }).map(() =>
            fetch('/api/record/manual', {
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
            }).then((r) => {
              if (!r.ok) throw new Error(`記録失敗（${r.status}）`);
              return r;
            })
          )
        )
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const okCount = results.length - failed;
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      if (failed === 0) {
        setSuccess(`${okCount}件を ${day}の${mealType} に記録しました`);
        clearCart();
        setCartOpen(false);
      } else {
        setError(`${failed}件の記録に失敗しました（${okCount}件は成功）`);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setSaving(false);
    }
  }

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((acc, l) => acc + l.qty, 0);
  const cartTotals = cartLines.reduce(
    (acc, { item, qty }) => ({
      kcal: acc.kcal + item.kcal * qty,
      P: acc.P + item.P * qty,
      F: acc.F + item.F * qty,
      C: acc.C + item.C * qty,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );

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
    <div className="min-h-screen bg-stone-50 pb-40">
      <PageHeader title="🔍 食品DB" back>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：鶏むね、おにぎり、味噌汁"
          className="w-full mt-3 bg-white text-stone-900 placeholder:text-stone-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
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
      </PageHeader>

      <div className="bg-white border-b border-stone-200 px-4 py-3">
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
                const inCart = cart[item.id];
                const qty = inCart?.qty || 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (qty === 0) addToCart(item);
                    }}
                    className={`w-full flex items-center justify-between border rounded-xl px-3 py-3 ${
                      qty > 0
                        ? 'bg-emerald-50 border-emerald-400 cursor-default'
                        : 'bg-white border-stone-200 active:bg-emerald-50 cursor-pointer'
                    }`}
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
                    {qty > 0 ? (
                      <div className="ml-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.id);
                          }}
                          className="w-7 h-7 rounded-full bg-white border border-stone-300 text-stone-700 font-bold text-base flex items-center justify-center active:bg-stone-100"
                          aria-label="数を減らす"
                        >
                          −
                        </button>
                        <span className="min-w-[20px] text-center text-sm font-bold text-emerald-700">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                          }}
                          className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center active:bg-emerald-700"
                          aria-label="数を増やす"
                        >
                          ＋
                        </button>
                      </div>
                    ) : (
                      <div className="ml-2 w-7 h-7 rounded-full bg-stone-100 border border-stone-300 text-stone-600 flex items-center justify-center text-base font-bold">
                        ＋
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <Link href="/home" className="block text-center text-xs text-stone-500 underline pt-4">
          🏠 ホームに戻る
        </Link>
      </main>

      {/* 下部固定カートバー */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t-2 border-emerald-500 px-4 py-3 z-40 shadow-2xl">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-2 active:opacity-70"
            >
              <div className="relative">
                <span className="text-2xl">🛒</span>
                <span className="absolute -top-1 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center shadow">
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-stone-500 font-medium leading-none">合計</div>
                <div className="text-lg font-bold text-stone-900 leading-tight">
                  {Math.round(cartTotals.kcal)}
                  <span className="text-xs font-normal text-stone-500 ml-0.5">kcal</span>
                </div>
              </div>
            </button>
            <button
              onClick={handleCommit}
              disabled={saving}
              className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? '記録中…' : `✅ ${day}の${mealType}に追加`}
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <CartSheet
          cart={cart}
          day={day}
          mealType={mealType}
          totals={cartTotals}
          saving={saving}
          onClose={() => setCartOpen(false)}
          onAdd={(id) => addToCart(cart[id].item)}
          onRemove={removeFromCart}
          onDelete={deleteFromCart}
          onClear={clearCart}
          onCommit={handleCommit}
        />
      )}

      <FooterNav />
    </div>
  );
}

function CartSheet({
  cart,
  day,
  mealType,
  totals,
  saving,
  onClose,
  onAdd,
  onRemove,
  onDelete,
  onClear,
  onCommit,
}: {
  cart: Record<string, CartLine>;
  day: DayLabel;
  mealType: MealType;
  totals: { kcal: number; P: number; F: number; C: number };
  saving: boolean;
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onCommit: () => void;
}) {
  const lines = Object.values(cart);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={saving ? undefined : onClose}>
      <div
        className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white pt-3 pb-3 border-b border-stone-200 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">🛒 カゴの中身（{count}点）</h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lines.length === 0 ? (
            <p className="text-center text-sm text-stone-500 py-8">カゴは空です</p>
          ) : (
            lines.map(({ item, qty }) => (
              <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-stone-900 truncate">{item.name}</div>
                  <div className="text-[10px] text-stone-600 mt-0.5">
                    {item.unit} ・ {item.kcal}kcal × {qty} = {item.kcal * qty}kcal
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 font-bold flex items-center justify-center active:bg-stone-300"
                    aria-label="数を減らす"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-stone-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => onAdd(item.id)}
                    className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center active:bg-emerald-700"
                    aria-label="数を増やす"
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="ml-1 text-stone-400 active:text-red-600"
                    aria-label="削除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-stone-200 p-4 space-y-3 flex-shrink-0">
            <div className="bg-stone-50 rounded-xl p-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-stone-600">合計</span>
                <span className="text-xl font-bold text-stone-900">
                  {Math.round(totals.kcal)}
                  <span className="text-xs font-normal text-stone-500 ml-1">kcal</span>
                </span>
              </div>
              <div className="text-[11px] text-stone-700">
                P {Math.round(totals.P * 10) / 10}g ・ F {Math.round(totals.F * 10) / 10}g ・ C {Math.round(totals.C * 10) / 10}g
              </div>
              <div className="text-[10px] text-stone-500 mt-1">{day}の{mealType}に記録</div>
            </div>
            <button
              onClick={onCommit}
              disabled={saving}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? '記録中…' : `✅ ${count}点を${day}の${mealType}に追加`}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="w-full text-[11px] text-stone-500 underline active:text-red-600 disabled:opacity-50"
            >
              カゴを空にする
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
