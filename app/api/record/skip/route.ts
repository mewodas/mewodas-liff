import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

// 「食べなかった」記録：0kcalで記録を残す
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, mealType, day } = body;

    if (!lineUserId || !mealType) {
      return NextResponse.json({ error: 'lineUserId, mealType は必須です' }, { status: 400 });
    }
    const validMeals = ['朝食', '昼食', '夕食', '間食'];
    if (!validMeals.includes(mealType)) {
      return NextResponse.json({ error: 'mealType が不正です' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer || customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 400 }
      );
    }

    const targetDate = getTargetDate(day || '今日');
    const pfc = {
      kcal: 0,
      P: 0,
      F: 0,
      C: 0,
      items: [{ name: '食べなかった', P: 0, F: 0, C: 0 }],
    };

    await saveFoodRecord({
      customerName: customer.name,
      lineUserId,
      pfc,
      mealType,
      goals: customer.goals,
      targetDate,
      supplementText: '食べなかった',
    });

    return NextResponse.json({ ok: true, pfc });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
