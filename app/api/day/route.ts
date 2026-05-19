import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDate,
  getDailyExtras,
  type FoodRecord,
} from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const date = req.nextUrl.searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'date が必要です' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(verifiedLineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const records = await getFoodRecordsByDate(verifiedLineUserId, date);
    const mealTypes: Array<'朝食' | '昼食' | '夕食' | '間食'> = ['朝食', '昼食', '夕食', '間食'];
    const mealsByType: Record<string, FoodRecord[]> = {};
    for (const t of mealTypes) {
      mealsByType[t] = records.filter((r) => r.mealType === t);
    }
    const totals = records.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    let weight = '';
    let exercised = '';
    let exerciseContent = '';
    if (customer.foodSheetPageId) {
      const [, mm, dd] = date.split('-').map(Number);
      const dateLabel = `${mm}月${dd}日`;
      const extras = await getDailyExtras(customer.foodSheetPageId, dateLabel);
      weight = extras.weight;
      exercised = extras.exercised;
      exerciseContent = extras.exerciseContent;
    }

    return NextResponse.json({
      customer: { name: customer.name, goals: customer.goals },
      day: {
        date,
        totals,
        mealsByType,
        recordCount: records.length,
        weight,
        exercised,
        exerciseContent,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
