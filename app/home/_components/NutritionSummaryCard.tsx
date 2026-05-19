function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function barColorFor(c: 'rose' | 'amber' | 'sky'): string {
  switch (c) {
    case 'rose': return 'bg-rose-500';
    case 'amber': return 'bg-amber-500';
    case 'sky': return 'bg-sky-500';
  }
}

export function NutritionSummaryCard({
  totals,
  goals,
}: {
  totals: { kcal: number; P: number; F: number; C: number };
  goals: { kcal: number; P: number; F: number; C: number };
}) {
  const kcalPct = goals.kcal > 0 ? Math.round((totals.kcal / goals.kcal) * 100) : 0;

  const pKcal = totals.P * 4;
  const fKcal = totals.F * 9;
  const cKcal = totals.C * 4;
  const totalPfcKcal = pKcal + fKcal + cKcal;
  const pPct = totalPfcKcal > 0 ? Math.round((pKcal / totalPfcKcal) * 100) : 0;
  const fPct = totalPfcKcal > 0 ? Math.round((fKcal / totalPfcKcal) * 100) : 0;
  const cPct = totalPfcKcal > 0 ? Math.max(0, 100 - pPct - fPct) : 0;

  const nutrients = [
    { label: 'たんぱく質', value: r1(totals.P), goal: goals.P, unit: 'g', color: 'rose' as const },
    { label: '脂質', value: r1(totals.F), goal: goals.F, unit: 'g', color: 'amber' as const },
    { label: '炭水化物', value: r1(totals.C), goal: goals.C, unit: 'g', color: 'sky' as const },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3">栄養サマリー</h2>

      <div className="mb-4">
        <div className="text-xs text-stone-600 mb-1">カロリー</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-stone-900">{Math.round(totals.kcal)}</span>
          <span className="text-sm font-medium text-stone-500">/ {goals.kcal} kcal</span>
        </div>
        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, kcalPct) || 0}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3 mb-4">
        {nutrients.map((n) => {
          const pctRaw = n.goal > 0 ? Math.round((n.value / n.goal) * 100) : 0;
          const pct = Math.min(100, pctRaw);
          const barColor = barColorFor(n.color);
          const isOver = pctRaw > 130;
          const isUnder = pctRaw < 70;
          return (
            <div key={n.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-medium text-stone-700">{n.label}</span>
                {isOver && <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1 rounded">過剰</span>}
                {isUnder && <span className="text-[9px] font-bold text-sky-600 bg-sky-100 px-1 rounded">不足</span>}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-base font-bold text-stone-900">{n.value}</span>
                <span className="text-[10px] text-stone-500">/ {n.goal}{n.unit}</span>
              </div>
              <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {totalPfcKcal > 0 && (
        <div>
          <div className="text-[11px] font-bold text-stone-700 mb-1.5">PFCバランス</div>
          <div className="flex h-5 rounded-full overflow-hidden border border-stone-200">
            <div className="bg-rose-400" style={{ width: `${pPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${fPct}%` }} />
            <div className="bg-sky-400" style={{ width: `${cPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-stone-600">
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-rose-400 rounded-sm mr-1" />
              P {pPct}%
            </span>
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-sm mr-1" />
              F {fPct}%
            </span>
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-sky-400 rounded-sm mr-1" />
              C {cPct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
