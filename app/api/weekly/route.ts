import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
  type FoodRecord,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;

type DailyAgg = {
  date: string; // 'yyyy-MM-dd'
  weekday: string; // '月'
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
};

// JST基準の日付を返す
function jstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 月曜始まりで week_offset で指定された週の月〜日を返す
// offset = 0: 今週, -1: 先週, +1: 来週
function getWeekRange(offset: number): { start: Date; end: Date; dates: Date[] } {
  const today = jstNow();
  const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // 月曜日まで戻す
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

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    const offsetStr = req.nextUrl.searchParams.get('offset') || '0';
    const offset = parseInt(offsetStr, 10) || 0;

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const { start, end, dates } = getWeekRange(offset);
    const startStr = formatDate(start);
    const endStr = formatDate(end);

    const records: FoodRecord[] = await getFoodRecordsByDateRange(lineUserId, startStr, endStr);

    // 日別集計
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const daily: DailyAgg[] = dates.map((d) => {
      const ds = formatDate(d);
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
      return {
        date: ds,
        weekday: dayNames[d.getDay()],
        kcal: Math.round(totals.kcal),
        P: Math.round(totals.P * 10) / 10,
        F: Math.round(totals.F * 10) / 10,
        C: Math.round(totals.C * 10) / 10,
        mealCount: dayRecords.length,
        recorded: dayRecords.length > 0,
      };
    });

    // 週合計と平均（記録ありの日のみで平均）
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
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
