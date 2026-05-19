'use client';

import Link from 'next/link';
import {
  UtensilsCrossed,
  ArrowRight,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  type LucideIcon,
} from 'lucide-react';
import type { MealRecord } from './types';

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

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function shortNameFromRecord(r: MealRecord): string {
  const memo = (r.memo || '').trim();
  if (!memo) return r.title || '食事';
  const beforeAi = memo.split(/\s*\/\s*AI識別[:：]/)[0] || memo;
  const firstItem = beforeAi.split(/[、,]/)[0]?.trim();
  return firstItem || beforeAi.slice(0, 30);
}

function unitFromName(name: string): string {
  const m = name.match(/\s+([0-9０-９.]+\s*(g|ml|個|本|杯|皿|枚|切れ|人前|匹|玉|串|缶|袋|箱|食|kg))$/);
  if (m) return m[1].trim();
  const m2 = name.match(/[（(]([^）)]+)[）)]\s*$/);
  if (m2 && /[0-9０-９]/.test(m2[1])) return m2[1].trim();
  return '1人前';
}

function toDriveThumbnailUrl(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return url;
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
}

export function MealSection({
  mealType,
  records,
  dayTotalKcal,
  selectedDate,
  lineUserId: _lineUserId,
  onDeleted: _onDeleted,
}: {
  mealType: string;
  records: MealRecord[];
  dayTotalKcal: number;
  selectedDate: string;
  lineUserId: string | null;
  onDeleted: () => void;
}) {
  const Icon = MEAL_ICON[mealType] || UtensilsCrossed;
  const iconColor = MEAL_COLOR[mealType] || 'text-stone-600';
  const totals = records.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      P: acc.P + r.P,
      F: acc.F + r.F,
      C: acc.C + r.C,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );
  const pctOfDay =
    dayTotalKcal > 0 ? Math.round((totals.kcal / dayTotalKcal) * 100) : 0;
  const hasRecords = records.length > 0;
  const datePart = `date=${selectedDate}`;
  const detailHref = `/meal-detail?${datePart}&meal=${encodeURIComponent(mealType)}`;
  const recordHref = `/record?${datePart}&meal=${encodeURIComponent(mealType)}`;

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <Link
        href={hasRecords ? detailHref : recordHref}
        className="block px-4 py-3 active:bg-stone-50"
      >
        <div className="flex justify-between items-center">
          <span className="font-bold text-stone-900 flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2.2} />
            {mealType}
          </span>
          <span className="text-sm font-bold text-stone-900">
            {hasRecords ? (
              <>
                {Math.round(totals.kcal)} kcal
                <span className="text-xs font-medium text-stone-500 ml-1">
                  （{pctOfDay}%）
                </span>
              </>
            ) : (
              <span className="text-stone-500 font-medium text-xs">未記録</span>
            )}
          </span>
        </div>
        {hasRecords && (
          <div className="mt-1 text-[11px] font-medium text-stone-700">
            P {r1(totals.P)}g ・ F {r1(totals.F)}g ・ C {r1(totals.C)}g
          </div>
        )}
      </Link>

      {hasRecords ? (
        <>
          <Link
            href={detailHref}
            className="block border-t border-stone-100 active:bg-stone-50"
          >
            <div className="divide-y divide-stone-100">
              {records.map((r) => {
                const isSkipped = r.memo === '食べなかった' || r.title === '食べなかった';
                const name = shortNameFromRecord(r);
                const unit = unitFromName(name);
                return (
                  <div key={r.pageId} className="flex items-center px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-stone-900 truncate">
                        {isSkipped ? '🚫 食べなかった' : name}
                      </div>
                      <div className="text-[10px] text-stone-600 mt-0.5">
                        {Math.round(r.kcal)} kcal
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 text-[11px] font-medium text-stone-700 border border-stone-300 px-2 py-0.5 rounded-full">
                      {unit}
                    </div>
                  </div>
                );
              })}
            </div>
          </Link>
          {records.some((r) => r.imageUrl) && (
            <Link
              href={detailHref}
              className="block border-t border-stone-100 px-4 py-3 active:bg-stone-50 overflow-x-auto scrollbar-hide"
            >
              <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                {Array.from(
                  records
                    .filter((r) => r.imageUrl)
                    .reduce((map, r) => {
                      const key = r.imageUrl!;
                      if (!map.has(key)) map.set(key, r);
                      return map;
                    }, new Map<string, MealRecord>())
                    .values(),
                ).map((r) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={r.pageId}
                    src={toDriveThumbnailUrl(r.imageUrl!)}
                    alt={r.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-20 h-20 object-cover rounded-xl bg-stone-100 flex-shrink-0"
                  />
                ))}
              </div>
            </Link>
          )}
        </>
      ) : (
        <Link
          href={recordHref}
          className="block px-4 pb-3 active:bg-stone-50"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <UtensilsCrossed className="w-3.5 h-3.5" strokeWidth={2.2} />
            食事を記録する
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
          </span>
        </Link>
      )}
    </section>
  );
}
