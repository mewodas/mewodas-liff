import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
  getRangeExtras,
} from '@/lib/notion';
import { listWeightLogsByLineUser } from '@/lib/repository/weightLogs';
import { listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DailyAgg = {
  day: number;
  date: string;
  weekday: number;
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
  exercised: boolean;
  weight: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const year = parseInt(req.nextUrl.searchParams.get('year') || '0', 10);
    const month = parseInt(req.nextUrl.searchParams.get('month') || '0', 10);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year と month（1-12）が必要です' }, { status: 400 });
    }

    const startStr = `${year}-${pad2(month)}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endStr = `${year}-${pad2(month)}-${pad2(lastDayOfMonth)}`;

    const [customer, records] = await Promise.all([
      getCustomerByLineId(verifiedLineUserId),
      getFoodRecordsByDateRange(verifiedLineUserId, startStr, endStr),
    ]);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const daysInMonth = lastDayOfMonth;
    const dateLabels: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      dateLabels.push(`${month}月${day}日`);
    }
    // 体重・運動とも「真実のソース」のDBから読む。個人シート（extras）は運動の
    // 補完（個人シートにしか無い運動日）として併用。旧実装は体重も運動も個人シート
    // から読んでおり、個人シートを持たない顧客の体重・運動が履歴に出ていなかった。
    const [extras, weightLogs, exerciseLogs] = await Promise.all([
      customer.foodSheetPageId
        ? getRangeExtras(customer.foodSheetPageId, dateLabels)
        : Promise.resolve(
            {} as Record<
              string,
              { weight: string; exercised: boolean; exerciseContent: string }
            >
          ),
      listWeightLogsByLineUser(verifiedLineUserId, startStr, endStr),
      listExerciseLogsByLineUser(verifiedLineUserId, startStr, endStr),
    ]);
    const weightByDate = new Map(weightLogs.map((w) => [w.date, w.weightKg]));
    // 運動日: 運動ログDB ∪ 個人シート（admin分析と同じ DB優先・日付dedup）
    const exercisedDates = new Set(exerciseLogs.map((e) => e.date).filter(Boolean));

    const daily: DailyAgg[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${pad2(month)}-${pad2(day)}`;
      const dateLabel = `${month}月${day}日`;
      const dayRecords = records.filter((r) => r.date === ds);
      const totals = dayRecords.reduce(
        (acc, r) => ({
          kcal: acc.kcal + r.kcal,
          P: acc.P + r.P,
          F: acc.F + r.F,
          C: acc.C + r.C,
        }),
        { kcal: 0, P: 0, F: 0, C: 0 }
      );
      const ex = extras[dateLabel];
      daily.push({
        day,
        date: ds,
        weekday: new Date(year, month - 1, day).getDay(),
        kcal: Math.round(totals.kcal),
        P: Math.round(totals.P * 10) / 10,
        F: Math.round(totals.F * 10) / 10,
        C: Math.round(totals.C * 10) / 10,
        mealCount: dayRecords.length,
        recorded: dayRecords.length > 0,
        exercised: exercisedDates.has(ds) || ex?.exercised || false,
        weight: weightByDate.has(ds) ? String(weightByDate.get(ds)) : '',
      });
    }

    const mealRatio: Record<string, number> = { 朝食: 0, 昼食: 0, 夕食: 0, 間食: 0 };
    for (const r of records) {
      if (r.mealType in mealRatio) {
        mealRatio[r.mealType] += r.kcal;
      }
    }

    return NextResponse.json({
      customer: {
        name: customer.name,
        goals: customer.goals,
      },
      month: {
        year,
        month,
        daysInMonth,
        firstWeekday: new Date(year, month - 1, 1).getDay(),
        daily,
        mealRatio,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
