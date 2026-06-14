import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
  getRangeExtras,
  type FoodRecord,
} from '@/lib/notion';
import { listWeightLogsByLineUser } from '@/lib/repository/weightLogs';
import { listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DailyAgg = {
  date: string;
  weekday: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
  weight: string;
  exercised: boolean;
  exerciseContent: string;
};

function jstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekRange(offset: number): { start: Date; end: Date; dates: Date[] } {
  const today = jstNow();
  const day = today.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  const sunday = dates[6];
  return { start: monday, end: sunday, dates };
}

export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const offsetStr = req.nextUrl.searchParams.get('offset') || '0';
    const offset = parseInt(offsetStr, 10) || 0;

    const { start, end, dates } = getWeekRange(offset);
    const startStr = formatDate(start);
    const endStr = formatDate(end);

    const [customer, records, weightLogs, exerciseLogs] = await Promise.all([
      getCustomerByLineId(verifiedLineUserId),
      getFoodRecordsByDateRange(verifiedLineUserId, startStr, endStr),
      listWeightLogsByLineUser(verifiedLineUserId, startStr, endStr),
      listExerciseLogsByLineUser(verifiedLineUserId, startStr, endStr),
    ]);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const dateLabels = dates.map((d) => `${d.getMonth() + 1}月${d.getDate()}日`);
    const extras = customer.foodSheetPageId
      ? await getRangeExtras(customer.foodSheetPageId, dateLabels)
      : {};

    // 体重・運動は「真実のソース」の各ログDBから。個人シート(extras)は補完として併用。
    const weightByDate = new Map(weightLogs.map((w) => [w.date, w.weightKg]));
    const exDates = new Set<string>();
    const exContentByDate = new Map<string, string>();
    for (const e of exerciseLogs) {
      if (!e.date) continue;
      exDates.add(e.date);
      const c = e.exercise && e.exercise !== '運動' ? e.exercise : '';
      if (c) {
        exContentByDate.set(e.date, [exContentByDate.get(e.date), c].filter(Boolean).join('\n'));
      }
    }

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const daily: DailyAgg[] = dates.map((d) => {
      const ds = formatDate(d);
      const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
      const dayRecords = records.filter((r: FoodRecord) => r.date === ds);
      const totals = dayRecords.reduce(
        (acc: { kcal: number; P: number; F: number; C: number }, r: FoodRecord) => ({
          kcal: acc.kcal + r.kcal,
          P: acc.P + r.P,
          F: acc.F + r.F,
          C: acc.C + r.C,
        }),
        { kcal: 0, P: 0, F: 0, C: 0 }
      );
      const ex = extras[dateLabel] || { weight: '', exercised: false, exerciseContent: '' };
      const weight = weightByDate.has(ds) ? String(weightByDate.get(ds)) : ex.weight;
      const exercised = exDates.has(ds) || ex.exercised;
      const exerciseContent = exContentByDate.get(ds) || ex.exerciseContent;
      return {
        date: ds,
        weekday: dayNames[d.getDay()],
        kcal: Math.round(totals.kcal),
        P: Math.round(totals.P * 10) / 10,
        F: Math.round(totals.F * 10) / 10,
        C: Math.round(totals.C * 10) / 10,
        mealCount: dayRecords.length,
        recorded: dayRecords.length > 0,
        weight,
        exercised,
        exerciseContent,
      };
    });

    const recordedDays = daily.filter((d) => d.recorded);
    const recordCount = recordedDays.length;
    const sum = daily.reduce(
      (acc, d) => ({
        kcal: acc.kcal + d.kcal,
        P: acc.P + d.P,
        F: acc.F + d.F,
        C: acc.C + d.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );
    const avg = recordCount > 0
      ? {
          kcal: Math.round(sum.kcal / recordCount),
          P: Math.round((sum.P / recordCount) * 10) / 10,
          F: Math.round((sum.F / recordCount) * 10) / 10,
          C: Math.round((sum.C / recordCount) * 10) / 10,
        }
      : { kcal: 0, P: 0, F: 0, C: 0 };

    const exerciseDays = daily.filter((d) => d.exercised).length;

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
        currentWeight: customer.currentWeight,
        targetWeight: customer.targetWeight,
        targetDate: customer.targetDate,
      },
      week: {
        offset,
        startDate: startStr,
        endDate: endStr,
        daily,
        sum,
        avg,
        recordedDays: recordCount,
        exerciseDays,
        mealRatio,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
