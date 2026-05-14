'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  UtensilsCrossed,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  X,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import { toDriveThumbnailUrl } from '@/lib/imageUrl';

type Customer = { pageId: string; name: string; foodStatus: string | null };

type Meal = {
  pageId: string;
  date: string;
  recordedAt: string;
  mealType: string;
  title: string;
  memo: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  imageUrl: string | null;
  details: { fiber: number; salt: number; iron: number; calcium: number; vitaminC: number } | null;
  lineUserId: string;
  customerId: string | null;
  customerName: string;
  customerStatus: string | null;
};

const MEAL_ICON: Record<string, LucideIcon> = {
  朝食: Sunrise,
  昼食: Sun,
  夕食: Moon,
  間食: Cookie,
};
const MEAL_COLOR: Record<string, string> = {
  朝食: 'text-orange-500',
  昼食: 'text-amber-500',
  夕食: 'text-indigo-500',
  間食: 'text-pink-500',
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysStr(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function fmtMd(s: string): string {
  const [, m, d] = s.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function weekdayOf(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// memo は「食材1 100g / 食材2 1個 / AI識別:...」のような形式。
// 先頭の「AI識別:」以前を取り出し、ユーザー識別しやすい表示にする。
function extractFoodLine(m: { title: string; memo: string }): string {
  const memo = (m.memo || '').trim();
  if (memo) {
    const beforeAi = memo.split(/\s*\/\s*AI識別[:：]/)[0]?.trim();
    if (beforeAi) return beforeAi;
  }
  return m.title || '食事';
}

export default function AdminMealsPage() {
  const today = jstTodayString();
  // 既定：過去7日
  const [from, setFrom] = useState<string>(addDaysStr(today, -6));
  const [to, setTo] = useState<string>(today);
  const [customerId, setCustomerId] = useState<string>('');
  const [weekday, setWeekday] = useState<string>(''); // '' = all
  const [meals, setMeals] = useState<Meal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Meal | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set('from', from);
        sp.set('to', to);
        if (customerId) sp.set('customerId', customerId);
        if (weekday) sp.set('weekday', weekday);
        const res = await fetch(`/api/admin/meals?${sp.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        if (cancelled) return;
        setMeals(j.meals || []);
        setCustomers(j.customers || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, customerId, weekday]);

  // 日付ごとにグルーピング
  const grouped = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const m of meals) {
      const arr = map.get(m.date) || [];
      arr.push(m);
      map.set(m.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [meals]);

  const totalCount = meals.length;

  return (
    <AdminShell title={`食事管理（${totalCount}件）`}>
      <div className="space-y-3">
        {/* フィルタ */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-stone-600 flex-shrink-0" strokeWidth={2.2} />
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-stone-500">〜</span>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex-1 min-w-[10rem] bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">すべての顧客</option>
              {customers.map((c) => (
                <option key={c.pageId} value={c.pageId}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">全曜日</option>
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={String(i)}>
                  {w}曜
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setFrom(today);
                setTo(today);
              }}
              className="px-2 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom(addDaysStr(today, -1));
                setTo(addDaysStr(today, -1));
              }}
              className="px-2 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              昨日
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom(addDaysStr(today, -6));
                setTo(today);
              }}
              className="px-2 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              直近7日
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom(addDaysStr(today, -29));
                setTo(today);
              }}
              className="px-2 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              直近30日
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            該当する食事記録がありません
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([date, list]) => (
              <section key={date} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">
                    {fmtMd(date)}（{WEEKDAYS[weekdayOf(date)]}）
                  </h3>
                  <span className="text-[11px] text-stone-500">{list.length}件</span>
                </div>
                <ul className="divide-y divide-stone-100">
                  {list.map((m) => {
                    const Icon = MEAL_ICON[m.mealType] || UtensilsCrossed;
                    const color = MEAL_COLOR[m.mealType] || 'text-stone-500';
                    return (
                      <li key={m.pageId}>
                        <button
                          type="button"
                          onClick={() => setDetail(m)}
                          className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-stone-50 active:bg-stone-100"
                        >
                          <Thumb url={m.imageUrl} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} strokeWidth={2.2} />
                              <span className="text-[11px] text-stone-600 flex-shrink-0">{m.mealType || '未分類'}</span>
                              <span className="text-[11px] text-stone-400 flex-shrink-0">・</span>
                              <span className="text-xs font-bold text-stone-900 truncate">{m.customerName}</span>
                            </div>
                            <div className="text-sm font-bold text-stone-900 mt-0.5 line-clamp-2 break-words leading-snug">
                              {extractFoodLine(m)}
                            </div>
                            <div className="text-[11px] text-stone-600 mt-0.5 truncate">
                              {Math.round(m.kcal)} kcal ・ P{r1(m.P)}・F{r1(m.F)}・C{r1(m.C)}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {detail && <MealDetailModal meal={detail} onClose={() => setDetail(null)} />}
      </div>
    </AdminShell>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-14 h-14 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
        <ImageIcon className="w-5 h-5 text-stone-400" strokeWidth={2} />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={toDriveThumbnailUrl(url, 200)} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
    </div>
  );
}

function MealDetailModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const Icon = MEAL_ICON[meal.mealType] || UtensilsCrossed;
  const color = MEAL_COLOR[meal.mealType] || 'text-stone-500';
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5 truncate">
            <Icon className={`w-4 h-4 ${color}`} strokeWidth={2.2} />
            {meal.customerName} ・ {fmtMd(meal.date)}（{WEEKDAYS[weekdayOf(meal.date)]}） {meal.mealType}
          </h2>
          <button type="button" onClick={onClose} className="text-stone-500 p-1">
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {meal.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toDriveThumbnailUrl(meal.imageUrl, 800)}
              alt=""
              className="w-full rounded-xl border border-stone-200 max-h-72 object-contain bg-stone-50"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="bg-stone-50 border border-stone-200 rounded-xl py-8 flex items-center justify-center text-stone-400 text-xs">
              <ImageIcon className="w-5 h-5 mr-1.5" strokeWidth={2} />
              写真なし
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold text-stone-500 mb-0.5">食事名・食材</div>
            <div className="text-sm font-bold text-stone-900 whitespace-pre-wrap break-words">
              {meal.title || meal.memo || '（なし）'}
            </div>
            {meal.title && meal.memo && meal.title !== meal.memo && (
              <div className="text-xs text-stone-700 mt-1 whitespace-pre-wrap break-words">
                {meal.memo}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Stat label="kcal" value={Math.round(meal.kcal)} unit="" highlight />
            <Stat label="P" value={r1(meal.P)} unit="g" />
            <Stat label="F" value={r1(meal.F)} unit="g" />
            <Stat label="C" value={r1(meal.C)} unit="g" />
          </div>

          {meal.details && (
            <div>
              <div className="text-[10px] font-bold text-stone-500 mb-1">詳細栄養素</div>
              <div className="grid grid-cols-5 gap-1.5">
                <Stat label="食物繊維" value={r1(meal.details.fiber)} unit="g" small />
                <Stat label="塩分" value={r1(meal.details.salt)} unit="g" small />
                <Stat label="鉄分" value={r1(meal.details.iron)} unit="mg" small />
                <Stat label="カルシウム" value={r1(meal.details.calcium)} unit="mg" small />
                <Stat label="VC" value={r1(meal.details.vitaminC)} unit="mg" small />
              </div>
            </div>
          )}

          <div className="text-[10px] text-stone-500">
            記録時刻: {new Date(meal.recordedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
          </div>

          {meal.customerId && (
            <div className="pt-2 border-t border-stone-100 flex gap-2">
              <Link
                href={`/admin/customers/${meal.customerId}/records?date=${meal.date}`}
                className="flex-1 text-center text-xs font-bold text-emerald-700 border border-emerald-500 px-3 py-2 rounded-xl hover:bg-emerald-50"
              >
                この日の全食事を見る
              </Link>
              <Link
                href={`/admin/customers/${meal.customerId}`}
                className="flex-1 text-center text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50"
              >
                顧客プロフィール
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight = false,
  small = false,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2 text-center ${
        highlight
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-stone-50 border-stone-200'
      }`}
    >
      <div className={`${small ? 'text-[9px]' : 'text-[10px]'} font-bold text-stone-600`}>{label}</div>
      <div className={`font-bold ${highlight ? 'text-emerald-700' : 'text-stone-900'} ${small ? 'text-xs' : 'text-base'}`}>
        {value}
        {unit && <span className={`${small ? 'text-[9px]' : 'text-[10px]'} font-medium ml-0.5`}>{unit}</span>}
      </div>
    </div>
  );
}
