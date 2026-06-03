import type { FoodRecord } from '@/lib/notion';
import type { Customer } from '@/lib/notion';

type Store = { name: string; signature: string } | null;

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_TYPE_MAP: Record<string, MealKey> = {
  朝食: 'breakfast',
  昼食: 'lunch',
  夕食: 'dinner',
  間食: 'snack',
};

type PFCSum = { kcal: number; P: number; F: number; C: number };

function emptySum(): PFCSum {
  return { kcal: 0, P: 0, F: 0, C: 0 };
}

function sumRecords(records: FoodRecord[]): PFCSum {
  return records.reduce(
    (acc, r) => ({
      kcal: acc.kcal + (r.kcal || 0),
      P: acc.P + (r.P || 0),
      F: acc.F + (r.F || 0),
      C: acc.C + (r.C || 0),
    }),
    emptySum()
  );
}

function pfcVars(prefix: string, s: PFCSum): Record<string, string> {
  return {
    [`${prefix}_kcal`]: String(Math.round(s.kcal)),
    [`${prefix}_P`]: String(Math.round(s.P * 10) / 10),
    [`${prefix}_F`]: String(Math.round(s.F * 10) / 10),
    [`${prefix}_C`]: String(Math.round(s.C * 10) / 10),
  };
}

export function buildReportVariables(
  records: FoodRecord[],
  customer: Customer,
  store: Store,
  dateRange: { startDate: string; endDate: string; isSingleDay: boolean },
  // 期間内の「最終日の体重」(kg)。null/未指定なら開始体重にフォールバック。
  lastWeight?: number | null
): Record<string, string> {
  const { startDate, endDate, isSingleDay } = dateRange;

  // 全体合計
  const sum = sumRecords(records);

  // 食事区分別集計
  const byMeal: Record<MealKey, FoodRecord[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const r of records) {
    const key = MEAL_TYPE_MAP[r.mealType];
    if (key) byMeal[key].push(r);
  }
  const mealSums: Record<MealKey, PFCSum> = {
    breakfast: sumRecords(byMeal.breakfast),
    lunch: sumRecords(byMeal.lunch),
    dinner: sumRecords(byMeal.dinner),
    snack: sumRecords(byMeal.snack),
  };

  // 日平均（範囲レポート時）
  const byDay = new Map<string, PFCSum>();
  for (const r of records) {
    const cur = byDay.get(r.date) ?? emptySum();
    byDay.set(r.date, {
      kcal: cur.kcal + (r.kcal || 0),
      P: cur.P + (r.P || 0),
      F: cur.F + (r.F || 0),
      C: cur.C + (r.C || 0),
    });
  }
  const totalDays = byDay.size;
  const avg: PFCSum =
    totalDays > 0
      ? {
          kcal: Math.round(sum.kcal / totalDays),
          P: Math.round((sum.P / totalDays) * 10) / 10,
          F: Math.round((sum.F / totalDays) * 10) / 10,
          C: Math.round((sum.C / totalDays) * 10) / 10,
        }
      : emptySum();

  const showKcal = isSingleDay ? Math.round(sum.kcal) : avg.kcal;
  const showP = isSingleDay ? Math.round(sum.P * 10) / 10 : avg.P;
  const showF = isSingleDay ? Math.round(sum.F * 10) / 10 : avg.F;
  const showC = isSingleDay ? Math.round(sum.C * 10) / 10 : avg.C;

  // 食事区分別の「1日あたり平均」。範囲レポートは記録日数で割る。
  // 単日レポートは totalDays=1 のため当日の合計値と一致する（従来挙動を維持）。
  const perDay = (s: PFCSum): PFCSum =>
    totalDays > 0
      ? { kcal: s.kcal / totalDays, P: s.P / totalDays, F: s.F / totalDays, C: s.C / totalDays }
      : emptySum();
  const mealAvgs: Record<MealKey, PFCSum> = {
    breakfast: perDay(mealSums.breakfast),
    lunch: perDay(mealSums.lunch),
    dinner: perDay(mealSums.dinner),
    snack: perDay(mealSums.snack),
  };

  // 表示用の体重: 最終日の実測体重を優先し、無ければ開始体重(kg)にフォールバック。
  const weightStr =
    lastWeight != null
      ? String(lastWeight)
      : customer.currentWeight !== null
        ? String(customer.currentWeight)
        : '-';

  const kcalRatio =
    customer.goals.kcal > 0 ? Math.round((showKcal / customer.goals.kcal) * 100) : 0;

  return {
    customer: customer.name,
    date: endDate,
    startDate,
    endDate,
    kcal: String(showKcal),
    P: String(showP),
    F: String(showF),
    C: String(showC),
    targetKcal: String(customer.goals.kcal),
    targetP: String(customer.goals.P),
    targetF: String(customer.goals.F),
    targetC: String(customer.goals.C),
    kcalRatio: String(kcalRatio),
    // 期間内の記録日数（合計と平均の根拠。テンプレで {days} として利用可）
    days: String(totalDays),
    // 期間の合計値（真の「月間合計」を出したい場合はテンプレで {total_*} を使う）
    total_kcal: String(Math.round(sum.kcal)),
    total_P: String(Math.round(sum.P * 10) / 10),
    total_F: String(Math.round(sum.F * 10) / 10),
    total_C: String(Math.round(sum.C * 10) / 10),
    weight: weightStr,
    targetWeight: customer.targetWeight !== null ? String(customer.targetWeight) : '-',
    daysToGoal: (() => {
      if (!customer.targetDate) return '-';
      const target = new Date(customer.targetDate).getTime();
      const today = new Date().setHours(0, 0, 0, 0);
      return String(Math.max(0, Math.ceil((target - today) / 86400000)));
    })(),
    storeName: store?.name || '',
    signature: store?.signature || '',
    ...pfcVars('breakfast', mealAvgs.breakfast),
    ...pfcVars('lunch', mealAvgs.lunch),
    ...pfcVars('dinner', mealAvgs.dinner),
    ...pfcVars('snack', mealAvgs.snack),
  };
}
