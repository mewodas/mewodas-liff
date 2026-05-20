import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listRecordsInRange } from '@/lib/repository/records';
import { listWeightLogsByLineUser } from '@/lib/repository/weightLogs';
import { listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';
import { withAdminTenant } from '@/lib/withTenant';
import { aggregateRecords, normalizeRange } from '@/lib/analysisAggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const GET = withAdminTenant(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const today = jstToday();
    const { from, to } = normalizeRange(
      url.searchParams.get('from') || today,
      url.searchParams.get('to') || today,
      today
    );

    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) return NextResponse.json({ error: 'lineUserId 未登録' }, { status: 400 });

    const [records, weightLogs, allWeightLogs, exerciseLogs] = await Promise.all([
      listRecordsInRange(customer.lineUserId, from, to),
      listWeightLogsByLineUser(customer.lineUserId, from, to),
      listWeightLogsByLineUser(customer.lineUserId),
      listExerciseLogsByLineUser(customer.lineUserId, from, to),
    ]);

    const agg = aggregateRecords(records, from, to);
    const days = agg.daily.length;
    const rangeLabel = from === to
      ? `${from}（1日）`
      : `${from} 〜 ${to}（${days}日間）`;

    const sortedAllWeightLogs = allWeightLogs
      .filter((w) => !!w.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const firstWeightLog = sortedAllWeightLogs[0] ?? null;

    const target = {
      currentWeight: customer.currentWeight,
      targetWeight: customer.targetWeight,
      targetDate: customer.targetDate,
      startDate: firstWeightLog ? firstWeightLog.date : null,
      startWeight: firstWeightLog ? firstWeightLog.weightKg : null,
    };

    return NextResponse.json({
      stats: { totalDays: agg.totalDays, avg: agg.avg, sum: agg.sum },
      daily: agg.daily,
      mealTypeKcal: agg.mealTypeKcal,
      mealTypeCount: agg.mealTypeCount,
      goals: customer.goals,
      target,
      weightLogs,
      exerciseLogs,
      rangeLabel,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
