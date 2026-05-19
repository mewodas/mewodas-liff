import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
  getRangeExtras,
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
  exercised: boolean;
  weight: string; // 体重(kg) 文字列、未記録は ''
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

    // 月の開始日と終了日
    const startStr = `${year}-${pad2(month)}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate(); // 翌月0日 = 当月末
    const endStr = `${year}-${pad2(month)}-${pad2(lastDayOfMonth)}`;

    // 並列実行で高速化
    const [customer, records] = await Promise.all([
      getCustomerByLineId(lineUserId),
      getFoodRecordsByDateRange(lineUserId, startStr, endStr),
    ]);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    // 個人シートから運動データを取得
    const daysInMonth = lastDayOfMonth;
    const dateLabels: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      dateLabels.push(`${month}月${day}日`);
    }
    const extras = customer.foodSheetPageId
      ? await getRangeExtras(customer.foodSheetPageId, dateLabels)
      : {};

    // 日別集計
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
        exercised: ex?.exercised || false,
        weight: ex?.weight || '',
      });
    }

    // 食事区分別の合計kcal（円グラフ用）
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
        firstWeekday: new Date(year, month - 1, 1).getDay(), // 1日の曜日
        daily,
        mealRatio,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
