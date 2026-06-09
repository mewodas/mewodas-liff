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
  lastWeight?: number | null,
  // 期間内の「最初の有効体重」(kg)。週次/月次の「開始 → 最終」表記に使用。
  firstWeight?: number | null,
  // 期間内に記録された体重の平均(kg)。週次レポートの「平均 / 現在」表記に使用。
  weightAvg?: number | null,
  // 前期間（前週/前月）の体重平均(kg)。「前週平均」表記に使用。
  prevWeightAvg?: number | null
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

  // 表示用の体重: 最終日の実測体重を優先し、無ければ登録体重(kg)にフォールバック。
  const endWeightNum =
    lastWeight != null ? lastWeight : customer.currentWeight !== null ? customer.currentWeight : null;
  // 開始体重: 期間内の最初の有効体重。無ければ最終体重にフォールバック（＝増減0）。
  const startWeightNum = firstWeight != null ? firstWeight : endWeightNum;
  const weightStr = endWeightNum != null ? String(endWeightNum) : '-';
  const startWeightStr = startWeightNum != null ? String(startWeightNum) : '-';
  // 増減（最終 − 開始）。週次/月次の「{startWeight}kg → {endWeight}kg（{weightDelta}kg）」用。
  const weightDeltaStr =
    startWeightNum != null && endWeightNum != null
      ? (() => {
          const d = Math.round((endWeightNum - startWeightNum) * 10) / 10;
          if (d > 0) return `+${d}`;
          if (d < 0) return String(d); // 既にマイナス符号付き
          return '±0';
        })()
      : '-';

  const kcalRatio =
    customer.goals.kcal > 0 ? Math.round((showKcal / customer.goals.kcal) * 100) : 0;

  // === 目標までのペース & 週間平均（目標比）評価（週次/月次レポート用） ===
  // 目標達成日・残り週数・必要ペース（GoalProgressCard と同ロジック。基準は登録体重）
  const cw = customer.currentWeight;
  const tw = customer.targetWeight;
  // 「現在」の基準体重: 週内記録の平均を優先し、無ければ登録体重にフォールバック。
  // 「残り」「必要ペース」もこの基準で算出する（表示の整合のため）。
  const baseWeightNum = weightAvg != null ? weightAvg : cw;
  let weeksToGoalNum: number | null = null;
  if (customer.targetDate) {
    const td = new Date(customer.targetDate).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((td - today) / 86400000);
    if (daysLeft > 0) weeksToGoalNum = Math.max(1, Math.ceil(daysLeft / 7));
  }
  const requiredPaceNum =
    baseWeightNum != null && tw != null && weeksToGoalNum
      ? Math.round((Math.abs(baseWeightNum - tw) / weeksToGoalNum) * 10) / 10
      : null;
  // 目標までの残り（絶対値・小数1桁）
  const weightRemainingNum =
    baseWeightNum != null && tw != null
      ? Math.round(Math.abs(baseWeightNum - tw) * 10) / 10
      : null;

  // 今週(=期間)の実ペース＝(最終−開始)を週あたりに正規化（週次は7日=1週、月次は日数/7週）
  let weekPaceNum: number | null = null;
  if (startWeightNum != null && endWeightNum != null) {
    const [psy, psm, psd] = startDate.split('-').map(Number);
    const [pey, pem, ped] = endDate.split('-').map(Number);
    const spanDays =
      Math.round(
        (new Date(pey, pem - 1, ped).getTime() - new Date(psy, psm - 1, psd).getTime()) / 86400000
      ) + 1;
    const weeks = Math.max(1, spanDays / 7);
    weekPaceNum = Math.round(((endWeightNum - startWeightNum) / weeks) * 10) / 10;
  }
  const fmtSigned = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? String(n) : '±0');
  const weekPaceStr = weekPaceNum != null ? fmtSigned(weekPaceNum) : '-';

  // 週平均体重・前期間平均・その差（前週平均比較・signed）
  // 平均が無い期間は最終体重 (weightStr) にフォールバック。
  const weightAvgStr = weightAvg != null ? String(weightAvg) : weightStr;
  const prevWeightAvgStr = prevWeightAvg != null ? String(prevWeightAvg) : '-';
  const weekAvgDeltaStr =
    weightAvg != null && prevWeightAvg != null
      ? fmtSigned(Math.round((weightAvg - prevWeightAvg) * 10) / 10)
      : '-';

  // 今週ペースの評価: 目標方向へ必要ペース以上=⭕ / 方向は合うが不足=🔺 / 逆方向=💦
  let weekPaceMark = '';
  if (weekPaceNum != null && cw != null && tw != null && requiredPaceNum != null && tw !== cw) {
    const goalDir = tw < cw ? -1 : 1; // -1=減量 / +1=増量
    const toward = goalDir < 0 ? -weekPaceNum : weekPaceNum; // 目標方向への週あたり変化量(正=前進)
    if (toward <= 0) weekPaceMark = '💦';
    else if (toward >= requiredPaceNum * 0.9) weekPaceMark = '⭕';
    else weekPaceMark = '🔺';
  }

  // 週間平均（1日あたり）の目標比評価: 90〜110%=⭕ / 80〜90%・110〜120%=🔺 / それ未満・超過=💦
  const ratioMark = (val: number, target: number): string => {
    if (!target || target <= 0) return '';
    const r = (val / target) * 100;
    if (r >= 90 && r <= 110) return '⭕';
    if ((r >= 80 && r < 90) || (r > 110 && r <= 120)) return '🔺';
    return '💦';
  };
  const kcalMark = ratioMark(showKcal, customer.goals.kcal);
  const pMark = ratioMark(showP, customer.goals.P);
  const fMark = ratioMark(showF, customer.goals.F);
  const cMark = ratioMark(showC, customer.goals.C);

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
    startWeight: startWeightStr,
    endWeight: weightStr,
    weightDelta: weightDeltaStr,
    // 週次レポート（新フォーマット）用: 週平均・前週平均・差・目標までの残り
    weightAvg: weightAvgStr,
    prevWeightAvg: prevWeightAvgStr,
    weekAvgDelta: weekAvgDeltaStr,
    weightRemaining: weightRemainingNum != null ? String(weightRemainingNum) : '-',
    targetWeight: customer.targetWeight !== null ? String(customer.targetWeight) : '-',
    // 目標達成日・残り週数・必要/実ペース（週次・月次レポート用）
    targetDate: customer.targetDate || '-',
    weeksToGoal: weeksToGoalNum != null ? String(weeksToGoalNum) : '-',
    requiredPace: requiredPaceNum != null ? String(requiredPaceNum) : '-',
    weekPace: weekPaceStr,
    weekPaceMark,
    // 週間平均（目標比）の評価絵文字（⭕/🔺/💦）
    kcalMark,
    PMark: pMark,
    FMark: fMark,
    CMark: cMark,
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
