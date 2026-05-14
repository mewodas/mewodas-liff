'use client';

import { Sunrise, Sun, Moon, Cookie, Salad, type LucideIcon } from 'lucide-react';

const COLORS: Record<string, string> = {
  朝食: '#fb923c', // orange-400
  昼食: '#facc15', // yellow-400
  夕食: '#a78bfa', // violet-400
  間食: '#f472b6', // pink-400
};
const ICONS: Record<string, LucideIcon> = {
  朝食: Sunrise,
  昼食: Sun,
  夕食: Moon,
  間食: Cookie,
};

export default function MealRatioChart({
  mealRatio,
  title = '食事ごとの割合',
}: {
  /** 朝食/昼食/夕食/間食 ごとの合計kcal */
  mealRatio: Record<string, number>;
  title?: string;
}) {
  const meals = (['朝食', '昼食', '夕食', '間食'] as const).map((type) => ({
    type,
    kcal: Math.max(0, mealRatio[type] || 0),
  }));
  const total = meals.reduce((sum, m) => sum + m.kcal, 0);
  if (total <= 0) return null;

  const radius = 42;
  const center = 50;
  let cumulativeAngle = -Math.PI / 2; // 12時位置から開始

  const segments = meals
    .filter((m) => m.kcal > 0)
    .map((m) => {
      const angle = (m.kcal / total) * Math.PI * 2;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      // 1セグメントが100%の場合は円を描くため特別処理
      if (m.kcal === total) {
        return {
          type: m.type,
          d: `M ${center - radius} ${center} a ${radius} ${radius} 0 1 0 ${
            radius * 2
          } 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`,
        };
      }
      return {
        type: m.type,
        d: `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 mb-3 border border-stone-200">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs font-bold text-stone-700 flex items-center gap-1">
          <Salad className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
          {title}
        </div>
        <div className="text-right">
          <span className="text-[10px] text-stone-500">総カロリー </span>
          <span className="text-base font-bold text-stone-900">{Math.round(total)}</span>
          <span className="text-[10px] text-stone-500 ml-0.5">kcal</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
          {segments.map((s) => (
            <path key={s.type} d={s.d} fill={COLORS[s.type]} />
          ))}
          <circle cx={center} cy={center} r={20} fill="white" />
          <text
            x={center}
            y={center - 2}
            textAnchor="middle"
            className="text-[7px] fill-stone-500 font-medium"
          >
            合計
          </text>
          <text
            x={center}
            y={center + 7}
            textAnchor="middle"
            className="text-[9px] fill-stone-900 font-bold"
          >
            {Math.round(total)}kcal
          </text>
        </svg>
        <div className="flex-1 min-w-0 space-y-1.5">
          {meals.map((m) => {
            const pct = total > 0 ? Math.round((m.kcal / total) * 100) : 0;
            return (
              <div key={m.type} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: COLORS[m.type] }}
                  />
                  <span className="text-stone-700 truncate flex items-center gap-1">
                    {(() => {
                      const Icon = ICONS[m.type];
                      return Icon ? (
                        <Icon className="w-3 h-3" strokeWidth={2.2} style={{ color: COLORS[m.type] }} />
                      ) : null;
                    })()}
                    {m.type}
                  </span>
                </div>
                <span className="text-stone-900 font-bold whitespace-nowrap ml-2">
                  {Math.round(m.kcal)}
                  <span className="text-stone-500 font-normal">kcal</span>
                  <span className="text-stone-500 font-normal ml-1">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
