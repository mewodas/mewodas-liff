import type { FoodRecord } from '@/lib/repository/records';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 集計が許容する最大期間（日）。Notion レート制限・タイムアウト対策の上限。 */
export const MAX_RANGE_DAYS = 366;

/**
 * from/to を安全な範囲に正規化する。
 * - 不正な日付文字列は today にフォールバック
 * - from > to は from = to に丸める
 * - 期間が MAX_RANGE_DAYS を超える場合は from を to 基準で切り詰める
 */
export function normalizeRange(
  from: string,
  to: string,
  today: string
): { from: string; to: string } {
  let f = DATE_RE.test(from) ? from : today;
  const t = DATE_RE.test(to) ? to : today;
  if (f > t) f = t; // YYYY-MM-DD は文字列比較で日付順
  const [fy, fm, fd] = f.split('-').map(Number);
  const [ty, tm, td] = t.split('-').map(Number);
  const span = Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86_400_000
  ) + 1;
  if (span > MAX_RANGE_DAYS) {
    const clamped = new Date(ty, tm - 1, td);
    clamped.setDate(clamped.getDate() - (MAX_RANGE_DAYS - 1));
    f = `${clamped.getFullYear()}-${String(clamped.getMonth() + 1).padStart(2, '0')}-${String(clamped.getDate()).padStart(2, '0')}`;
  }
  return { from: f, to: t };
}

export type DailyEntry = {
  date: string;
  kcal: number | null;
  P: number | null;
  F: number | null;
  C: number | null;
  count: number;
};

export type AggregateResult = {
  totalDays: number;
  avg: { kcal: number; P: number; F: number; C: number };
  sum: { kcal: number; P: number; F: number; C: number };
  daily: DailyEntry[];
  mealTypeKcal: Record<string, number>;
  mealTypeCount: Record<string, number>;
  recordsSummary: string;
  top20Foods: string;
};

export function aggregateRecords(
  records: FoodRecord[],
  from: string,
  to: string
): AggregateResult {
  const mealTypeKcal: Record<string, number> = { 朝食: 0, 昼食: 0, 夕食: 0, 間食: 0 };
  // 食事区分ごとに「記録した日」を集合で保持。1食あたり平均の分母は食事日数とする
  // （1食を複数品目に分けて記録するとレコード数では過大になり1品目あたりになってしまうため）
  const mealTypeDates: Record<string, Set<string>> = {
    朝食: new Set(), 昼食: new Set(), 夕食: new Set(), 間食: new Set(),
  };
  const foodCount = new Map<string, number>();

  const byDay = new Map<string, { kcal: number; P: number; F: number; C: number; count: number; meals: string[] }>();
  for (const r of records) {
    const cur = byDay.get(r.date) || { kcal: 0, P: 0, F: 0, C: 0, count: 0, meals: [] };
    cur.kcal += r.kcal;
    cur.P += r.P;
    cur.F += r.F;
    cur.C += r.C;
    cur.count += 1;
    const item = (r.memo || r.title || '').split(/\s*\/\s*AI識別[:：]/)[0]?.trim().slice(0, 50);
    if (item) cur.meals.push(`${r.mealType}:${item}`);
    byDay.set(r.date, cur);

    if (r.mealType in mealTypeKcal) {
      mealTypeKcal[r.mealType] += r.kcal;
      mealTypeDates[r.mealType].add(r.date);
    }
    const rawItem = (r.memo || r.title || '').split(/\s*\/\s*AI識別[:：]/)[0]?.trim();
    if (rawItem) {
      const parts = rawItem.split(/[、,・\s]+/).filter((s) => s.length > 0 && s.length <= 20);
      for (const p of parts) {
        foodCount.set(p, (foodCount.get(p) || 0) + 1);
      }
    }
  }

  const sorted = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const totalDays = sorted.length;
  const sumRaw = sorted.reduce(
    (acc, [, v]) => ({
      kcal: acc.kcal + v.kcal,
      P: acc.P + v.P,
      F: acc.F + v.F,
      C: acc.C + v.C,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );
  const sum = { ...sumRaw, kcal: Math.round(sumRaw.kcal) };
  const avg = totalDays > 0
    ? {
        kcal: Math.round(sumRaw.kcal / totalDays),
        P: Math.round((sumRaw.P / totalDays) * 10) / 10,
        F: Math.round((sumRaw.F / totalDays) * 10) / 10,
        C: Math.round((sumRaw.C / totalDays) * 10) / 10,
      }
    : { kcal: 0, P: 0, F: 0, C: 0 };

  // 日別データ（チャート用）— from〜to の全日を埋めて記録なしは null
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const startDt = new Date(fy, fm - 1, fd);
  const endDt = new Date(ty, tm - 1, td);
  const days = Math.round((endDt.getTime() - startDt.getTime()) / 86_400_000) + 1;

  const daily: DailyEntry[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(fy, fm - 1, fd + i);
    const d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const v = byDay.get(d);
    daily.push({
      date: d,
      kcal: v ? Math.round(v.kcal) : null,
      P: v ? Math.round(v.P * 10) / 10 : null,
      F: v ? Math.round(v.F * 10) / 10 : null,
      C: v ? Math.round(v.C * 10) / 10 : null,
      count: v ? v.count : 0,
    });
  }

  // テキストサマリー（AI に渡す）
  const lines: string[] = [];
  lines.push(`記録日数: ${totalDays}/${days}日`);
  lines.push(`平均: ${avg.kcal}kcal / P${avg.P}g / F${avg.F}g / C${avg.C}g（記録日平均）`);
  lines.push('');
  lines.push('日別:');
  for (const [date, v] of sorted.slice(-21)) {
    const sample = v.meals.slice(0, 4).join('、') || '記録なし';
    lines.push(
      `${date} (${v.count}食): ${Math.round(v.kcal)}kcal P${Math.round(v.P)} F${Math.round(v.F)} C${Math.round(v.C)} — ${sample}`
    );
  }
  const recordsSummary = lines.join('\n');

  const top20Foods = Array.from(foodCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, cnt]) => `${name}(${cnt}回)`)
    .join('、');

  // 1食あたり平均の分母 = 食事区分ごとの記録日数
  const mealTypeCount: Record<string, number> = {
    朝食: mealTypeDates.朝食.size,
    昼食: mealTypeDates.昼食.size,
    夕食: mealTypeDates.夕食.size,
    間食: mealTypeDates.間食.size,
  };

  return { totalDays, avg, sum, daily, mealTypeKcal, mealTypeCount, recordsSummary, top20Foods };
}
