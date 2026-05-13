import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDate,
  getTargetDate,
  type FoodRecord,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }
    if (customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 403 }
      );
    }

    const today = getTargetDate('今日');
    const records = await getFoodRecordsByDate(lineUserId, today);

    // 食事区分ごとにグルーピング
    const mealTypes: Array<'朝食' | '昼食' | '夕食' | '間食'> = ['朝食', '昼食', '夕食', '間食'];
    const mealsByType: Record<string, FoodRecord[]> = {};
    for (const t of mealTypes) {
      mealsByType[t] = records.filter((r) => r.mealType === t);
    }

    // 合計
    const totals = records.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    return NextResponse.json({
      customer: {
        name: customer.name,
        goals: customer.goals,
        currentWeight: customer.currentWeight,
        targetWeight: customer.targetWeight,
        targetDate: customer.targetDate,
      },
      today: {
        date: today,
        totals,
        mealsByType,
        recordCount: records.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
