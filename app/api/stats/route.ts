import { NextRequest, NextResponse } from 'next/server';
import { getFoodRecordsByDateRange, getTargetDate, type FoodRecord } from '@/lib/notion';
import { computeStreakStats } from '@/lib/streakStats';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 20;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ホームの連続記録バッジ用。/api/today から30日集計を分離し、ファーストビュー
//（今日の食事・目標）をブロックしないようにする（today は ?stats=0 で軽量化）。
// 統計は常に「実際の今日」基準（閲覧中の日付に依存しない）。
export const GET = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const todayActual = getTargetDate('今日');
    const start = new Date(todayActual);
    start.setDate(start.getDate() - 29);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

    const records = await getFoodRecordsByDateRange(verifiedLineUserId, startStr, todayActual).catch(
      () => [] as FoodRecord[]
    );
    const stats = computeStreakStats(records, todayActual);

    const res = NextResponse.json({ stats });
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
