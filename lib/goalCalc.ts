// 目標kcal・PFC 自動計算ロジック
// Mifflin-St Jeor 式で BMR → TDEE → 目標達成日までの体重差から
// 1日あたりカロリー差分を引いて目標kcal を算出。

export const ACTIVITY_LEVELS = [
  { label: 'ほぼ運動なし', factor: 1.2 },
  { label: '軽い', factor: 1.375 },
  { label: '中等度', factor: 1.55 },
  { label: '激しい', factor: 1.725 },
] as const;

export const PLANS = ['減量', '維持', '増量'] as const;

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
  clampedDelta: number; // 安全レンジ内にクランプ後
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

  // 安全レンジ ±1000kcal/日 にクランプ。極端な体重差は警告
  const clampedDelta = Math.max(-1000, Math.min(1000, dailyDeltaKcal));
  if (Math.abs(dailyDeltaKcal - clampedDelta) > 1) {
    notes.push(`目標差が大きいため1日±1000kcalに調整（実際の差分 ${Math.round(dailyDeltaKcal)}kcal/日）`);
  }

  // プラン別 PFC g/kg 現在体重
  const planNorm = plan || (
    targetWeight !== null && currentWeight !== null
      ? (targetWeight < currentWeight ? '減量' : targetWeight > currentWeight ? '増量' : '維持')
      : '維持'
  );
  const macroRatio =
    planNorm === '減量' ? { P: 2.0, F: 0.8 }
    : planNorm === '増量' ? { P: 1.8, F: 1.0 }
    : { P: 1.6, F: 1.0 };

  // 目標kcal: 維持なら TDEE のみ、それ以外は差分込み
  const goalKcalRaw = planNorm === '維持' ? tdee : tdee + clampedDelta;
  // 最低 1200kcal を下回らない（女性最低）/ 最大 4000kcal
  const goalKcal = Math.round(Math.max(1200, Math.min(4000, goalKcalRaw)) / 10) * 10;
  if (goalKcalRaw !== goalKcal) {
    notes.push(`安全レンジ (1200〜4000kcal) でクランプ`);
  }

  const goalP = Math.round(currentWeight * macroRatio.P * 10) / 10;
  const goalF = Math.round(currentWeight * macroRatio.F * 10) / 10;
  const remainingKcal = goalKcal - goalP * 4 - goalF * 9;
  const goalC = Math.max(0, Math.round((remainingKcal / 4) * 10) / 10);

  return {
    bmr,
    tdee,
    remainingDays,
    dailyDeltaKcal: Math.round(dailyDeltaKcal),
    clampedDelta: Math.round(clampedDelta),
    goalKcal,
    goalP,
    goalF,
    goalC,
    notes,
  };
}
