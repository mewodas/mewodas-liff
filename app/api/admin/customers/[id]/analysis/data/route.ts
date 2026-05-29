import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listRecordsInRange } from '@/lib/repository/records';
import { listWeightLogsByLineUser } from '@/lib/repository/weightLogs';
import { listExerciseLogsByLineUser, type ExerciseLog } from '@/lib/repository/exerciseLogs';
import { withAdminTenant } from '@/lib/withTenant';
import { aggregateRecords, normalizeRange } from '@/lib/analysisAggregate';
import { getRangeExtras, isoToJpMd } from '@/lib/notion';

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

    // dateLabels と iso↔label マップを構築（getRangeExtras は 'M月d日' キーで返す）
    const dateLabels: string[] = [];
    const labelToIso: Record<string, string> = {};
    const [fromY, fromM, fromD] = from.split('-').map(Number);
    const [toY, toM, toD] = to.split('-').map(Number);
    const startDt = new Date(fromY, fromM - 1, fromD);
    const endDt = new Date(toY, toM - 1, toD);
    for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = isoToJpMd(iso);
      dateLabels.push(label);
      labelToIso[label] = iso;
    }

    const [records, weightLogs, allWeightLogs, dbExerciseLogs, sheetExtras] = await Promise.all([
      listRecordsInRange(customer.lineUserId, from, to),
      listWeightLogsByLineUser(customer.lineUserId, from, to),
      listWeightLogsByLineUser(customer.lineUserId),
      listExerciseLogsByLineUser(customer.lineUserId, from, to),
      customer.foodSheetPageId
        ? getRangeExtras(customer.foodSheetPageId, dateLabels)
        : Promise.resolve({}),
    ]);

    // 個人シート由来の運動を ExerciseLog 形式に変換
    const dbDates = new Set(dbExerciseLogs.map((e) => e.date));
    const sheetExerciseLogs: ExerciseLog[] = [];
    const typedExtras = sheetExtras as Record<string, { weight: string; exercised: boolean; exerciseContent: string }>;
    for (const [label, extra] of Object.entries(typedExtras)) {
      if (!extra.exercised) continue;
      const iso = labelToIso[label];
      if (!iso) continue;
      if (dbDates.has(iso)) continue; // 運動DB側を優先
      sheetExerciseLogs.push({
        id: `sheet-${iso}`,
        lineUserId: customer.lineUserId,
        customerName: customer.name,
        date: iso,
        exercise: extra.exerciseContent || '運動',
        category: '',
        durationMin: 0,
        intensity: '',
        estimatedKcal: 0,
        memo: '',
        createdAt: '',
      });
    }

    const exerciseLogs = [...dbExerciseLogs, ...sheetExerciseLogs];

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
      // 目標ラインの起点: 日付は初回体重記録日、体重は顧客プロフィールの「開始体重(kg)」
      // （目標設定の「あと N kg 減量」と同じ基準にそろえる）
      startDate: firstWeightLog ? firstWeightLog.date : null,
      startWeight: customer.currentWeight,
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
