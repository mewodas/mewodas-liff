import type { FoodRecord } from '@/lib/notion';

export type StreakStats = {
  streakDays: number;
  bestStreakDays: number;
  last30RecordedDays: number;
  monthlyRecordedDays: number;
};

/**
 * 直近30日の食事記録から連続記録日数などのストリーク統計を算出する。
 * ホームの「🏅 N日」バッジ用。/api/stats と /api/today（フル版）で共用。
 */
export function computeStreakStats(records: FoodRecord[], todayStr: string): StreakStats {
  const byDate = new Map<string, { kcal: number; recorded: boolean }>();
  for (const r of records) {
    const cur = byDate.get(r.date) || { kcal: 0, recorded: false };
    cur.kcal += r.kcal;
    cur.recorded = true;
    byDate.set(r.date, cur);
  }

  const today = new Date(todayStr);
  let streakDays = 0;
  let bestStreakDays = 0;
  let currentStreakInWindow = 0;
  let last30RecordedDays = 0;
  let monthlyRecordedDays = 0;
  let stoppedCurrentStreak = false;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = byDate.get(ds);
    const isCurrentMonth =
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    if (day?.recorded) {
      if (!stoppedCurrentStreak) streakDays++;
      last30RecordedDays++;
      if (isCurrentMonth) monthlyRecordedDays++;
      currentStreakInWindow++;
      if (currentStreakInWindow > bestStreakDays) bestStreakDays = currentStreakInWindow;
    } else {
      if (i !== 0) {
        stoppedCurrentStreak = true;
        currentStreakInWindow = 0;
      }
    }
  }

  return {
    streakDays,
    bestStreakDays,
    last30RecordedDays,
    monthlyRecordedDays,
  };
}
