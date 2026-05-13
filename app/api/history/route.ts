import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DailyAgg = {
  day: number; // 日（1-31）
  date: string; // 'yyyy-MM-dd'
  weekday: number; // 0=日 ... 6=土
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    const year = parseInt(req.nextUrl.searchParams.get('year') || '0', 10);
    const month = parseInt(req.nextUrl.searchParams.get('month') || '0', 10);

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year と month（1-12）が必要です' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    // 月の開始日と終了日
    const startStr = `${year}-${pad2(month)}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate(); // 翌月0日 = 当月末
    const endStr = `${year}-${pad2(month)}-${pad2(lastDayOfMonth)}`;

    const records = await getFoodRecordsByDateRange(lineUserId, startStr, endStr);

    // 日別集計
    const daysInMonth = lastDayOfMonth;
    const daily: DailyAgg[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${pad2(month)}-${pad2(day)}`;
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
      });
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
        firstWeekday: new Date(year, month - 1, 1).getDay(), // 1日の曜日
        daily,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
