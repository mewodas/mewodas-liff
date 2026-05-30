// 「2日連続記録なし」= 今日と昨日の2日記録なし = 最終記録が2日以上前
const NO_RECORD_THRESHOLD_DAYS = 2;
const STALL_MOVEMENT_KG = 0.1;

export type RecordGapResult = {
  noRecord: boolean;
  daysSinceLastRecord: number | null;
};

export type WeightStallResult = {
  stalled: boolean;
  weeklyAvgs: number[];
};

function dateDiffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function computeRecordGap(
  latestRecordDate: string | null,
  today: string
): RecordGapResult {
  if (!latestRecordDate) {
    return { noRecord: true, daysSinceLastRecord: null };
  }
  const diff = dateDiffDays(latestRecordDate, today);
  return {
    noRecord: diff >= NO_RECORD_THRESHOLD_DAYS,
    daysSinceLastRecord: diff,
  };
}

export function computeWeightStall(
  weightLogs: { date: string; weightKg: number }[],
  goalDirection: 'down' | 'up',
  today: string
): WeightStallResult {
  const todayMs = new Date(today).getTime();

  const buckets: number[][] = [[], [], []];
  for (const log of weightLogs) {
    const diff = Math.round(
      (todayMs - new Date(log.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff < 0) continue;
    if (diff <= 6) buckets[0].push(log.weightKg);
    else if (diff <= 13) buckets[1].push(log.weightKg);
    else if (diff <= 20) buckets[2].push(log.weightKg);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgs = buckets.map(avg);
  const weeklyAvgs = avgs.map((v) => (v === null ? 0 : v));

  const w0 = avgs[0];
  const w1 = avgs[1];
  const w2 = avgs[2];

  if (w0 === null || w1 === null || w2 === null) {
    return { stalled: false, weeklyAvgs };
  }

  const notMoving01 =
    goalDirection === 'down'
      ? w0 - w1 >= -STALL_MOVEMENT_KG
      : w1 - w0 >= -STALL_MOVEMENT_KG;
  const notMoving12 =
    goalDirection === 'down'
      ? w1 - w2 >= -STALL_MOVEMENT_KG
      : w2 - w1 >= -STALL_MOVEMENT_KG;

  return { stalled: notMoving01 && notMoving12, weeklyAvgs };
}
