import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// AI解析を経ずに、提案された料理のPFCをそのまま記録するエンドポイント
// 「これ食べた」ワンタップ記録用
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, mealType, title, kcal, P, F, C, day } = body;

    if (!lineUserId || !mealType || !title) {
      return NextResponse.json(
        { error: 'lineUserId, mealType, title は必須です' },
        { status: 400 }
      );
    }
    if (typeof kcal !== 'number' || typeof P !== 'number' || typeof F !== 'number' || typeof C !== 'number') {
      return NextResponse.json(
        { error: 'kcal, P, F, C は数値で指定してください' },
        { status: 400 }
      );
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
      kcal: Math.round(kcal),
      P: Math.round(P * 10) / 10,
      F: Math.round(F * 10) / 10,
      C: Math.round(C * 10) / 10,
      items: [{ name: `${title}（AI提案・推定値）`, P, F, C }],
    };

    await saveFoodRecord({
      customerName: customer.name,
      lineUserId,
      pfc,
      mealType,
      goals: customer.goals,
      targetDate,
      supplementText: `AI提案からワンタップ記録：${title}`,
    });

    return NextResponse.json({ ok: true, pfc });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
