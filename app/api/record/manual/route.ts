import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { mealType, title, kcal, P, F, C, day, date, source } = body;

    if (!mealType || !title) {
      return NextResponse.json(
        { error: 'mealType, title は必須です' },
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

    const customer = await getCustomerByLineId(verifiedLineUserId);
    if (!customer || customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 400 }
      );
    }

    const sourceLabel: Record<string, string> = {
      ai_suggest: 'AI提案から登録',
      food_db: '食品DBから登録',
      barcode: 'バーコードから登録',
      frequent: 'よく食べるから登録',
      my_menu: 'マイメニューから登録',
      meal_plan: 'AI献立から登録',
      nutrition_label: '成分表から登録',
    };
    const label = sourceLabel[source] || '手動登録';

    const targetDate =
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : getTargetDate(day || '今日');
    const displayTitle = `${title} ｜ ${label}`;
    const pfc = {
      kcal: Math.round(kcal),
      P: Math.round(P * 10) / 10,
      F: Math.round(F * 10) / 10,
      C: Math.round(C * 10) / 10,
      items: [{ name: title, P, F, C }],
    };

    await saveFoodRecord({
      customerName: customer.name,
      lineUserId: verifiedLineUserId,
      pfc,
      mealType,
      goals: customer.goals,
      targetDate,
      supplementText: displayTitle,
    });

    return NextResponse.json({ ok: true, pfc });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
