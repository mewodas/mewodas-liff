// 目標kcal・PFC 自動計算ロジック
// Mifflin-St Jeor 式で BMR → TDEE → 目標達成日までの体重差から
// 1日あたりカロリー差分を引いて目標kcal を算出。

export const ACTIVITY_LEVELS = [
  { label: 'ほぼ運動なし', displayLabel: 'ほぼ運動なし（デスクワーク中心）', factor: 1.2 },
  { label: '軽い', displayLabel: '軽い運動（週1-2回）', factor: 1.375 },
  { label: '中等度', displayLabel: '中程度の運動（週3-4回）', factor: 1.55 },
  { label: '激しい', displayLabel: '激しい運動（毎日）', factor: 1.725 },
] as const;

export const PLANS = ['減量', '増量', '筋肥大', '現状維持'] as const;

export type ActivityLabel = typeof ACTIVITY_LEVELS[number]['label'];
export type Plan = typeof PLANS[number];

export function activityFactor(label: string | null | undefined): number {
  const found = ACTIVITY_LEVELS.find((l) => l.label === label);
  return found?.factor ?? 1.375;
}

export function calcBmr(opts: {
  gender: string | null | undefined;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * opts.weightKg + 6.25 * opts.heightCm - 5 * opts.age;
  // 男性 +5、女性 -161、未設定は中間値（-78）
  if (opts.gender === '男性') return Math.round(base + 5);
  if (opts.gender === '女性') return Math.round(base - 161);
  return Math.round(base - 78);
}

export function daysUntil(targetDateStr: string, todayStr: string): number {
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const [cy, cm, cd] = todayStr.split('-').map(Number);
  if (!ty || !cy) return 0;
  const t = new Date(ty, tm - 1, td);
  const c = new Date(cy, cm - 1, cd);
  return Math.round((t.getTime() - c.getTime()) / 86_400_000);
}

export type GoalInputs = {
  gender: string | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: string | null;
  plan: string | null;
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
};

export type CalcResult = {
  bmr: number;
  tdee: number;
  remainingDays: number;
  dailyDeltaKcal: number; // 体重差/残日から算出した1日差分（減量なら負）
  clampedDelta: number; // 後方互換のため残置（実装は dailyDeltaKcal と同値、クランプは撤去済み）
  isUnsafeDeficit: boolean; // 1日 -1000kcal 超の減量
  isUnsafeSurplus: boolean; // 1日 +1000kcal 超の増量
  isUnsafeGoalKcal: boolean; // 目標 kcal が 1200 未満 or 4000 超
  goalKcal: number;
  goalP: number;
  goalF: number;
  goalC: number;
  notes: string[];
};

export function calcGoals(inp: GoalInputs): CalcResult | null {
  const { gender, heightCm, age, activityLevel, plan, currentWeight, targetWeight, targetDate, today } = inp;
  const notes: string[] = [];

  if (!heightCm || !age || !currentWeight) {
    return null;
  }

  const bmr = calcBmr({ gender, weightKg: currentWeight, heightCm, age });
  const factor = activityFactor(activityLevel);
  const tdee = Math.round(bmr * factor);

  const remainingDays = targetDate ? daysUntil(targetDate, today) : 0;

  let dailyDeltaKcal = 0;
  if (targetWeight !== null && remainingDays > 0) {
    // 減量なら (target < current) で負方向
    dailyDeltaKcal = ((targetWeight - currentWeight) * 7700) / remainingDays;
  }

  // 安全上限 ±1000kcal/日 を超えた場合は警告のみ（値はクランプせずそのまま使う）
  const isUnsafeDeficit = dailyDeltaKcal < -1000;
  const isUnsafeSurplus = dailyDeltaKcal > 1000;
  if (Math.abs(dailyDeltaKcal) > 1000) {
    notes.push(`1日±1000kcal の安全上限を超えています（実際の差分 ${Math.round(dailyDeltaKcal)}kcal/日）`);
  }

  // プラン別 PFC g/kg 現在体重
  const planNorm = plan || (
    targetWeight !== null && currentWeight !== null
      ? (targetWeight < currentWeight ? '減量' : targetWeight > currentWeight ? '増量' : '現状維持')
      : '現状維持'
  );
  const macroRatio =
    planNorm === '減量' ? { P: 2.2, F: 0.8 }
    : planNorm === '増量' ? { P: 2.0, F: 1.0 }
    : planNorm === '筋肥大' ? { P: 2.5, F: 0.8 }
    : { P: 1.6, F: 1.0 }; // 現状維持

  // プラン補正: 減量=-500 / 増量=+300 / 筋肥大=+200 / 現状維持=0（targetWeight ある場合のみ達成日逆算で上書き）
  const planDelta =
    planNorm === '減量' ? -500
    : planNorm === '増量' ? 300
    : planNorm === '筋肥大' ? 200
    : 0;
  // 達成日逆算が有意な場合はそちらを優先、なければプラン補正
  const usedDelta = (targetWeight !== null && remainingDays > 0) ? dailyDeltaKcal : planDelta;
  const goalKcalRaw = tdee + usedDelta;
  // 10刻みに丸めるだけ（クランプはしない、極端値は警告で対応）
  const goalKcal = Math.round(goalKcalRaw / 10) * 10;
  const isUnsafeGoalKcal = goalKcal < 1200 || goalKcal > 4000;
  if (isUnsafeGoalKcal) {
    notes.push(`目標カロリーが安全レンジ (1200〜4000kcal) 外です`);
  }

  // PFC は「目標体重」ベースで計算（減量目的なら未来の自分の体重を基準にする）
  // targetWeight 未設定なら currentWeight にフォールバック
  const macroBaseWeight = targetWeight ?? currentWeight;
  const goalP = Math.round(macroBaseWeight * macroRatio.P * 10) / 10;
  const goalF = Math.round(macroBaseWeight * macroRatio.F * 10) / 10;
  const remainingKcal = goalKcal - goalP * 4 - goalF * 9;
  const goalC = Math.max(0, Math.round((remainingKcal / 4) * 10) / 10);

  return {
    bmr,
    tdee,
    remainingDays,
    dailyDeltaKcal: Math.round(dailyDeltaKcal),
    clampedDelta: Math.round(dailyDeltaKcal), // 後方互換: clamp 撤去のため raw と同じ値
    isUnsafeDeficit,
    isUnsafeSurplus,
    isUnsafeGoalKcal,
    goalKcal,
    goalP,
    goalF,
    goalC,
    notes,
  };
}
