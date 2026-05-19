import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { mealType, day, date } = body;

    if (!mealType) {
      return NextResponse.json({ error: 'mealType は必須です' }, { status: 400 });
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

    const targetDate =
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : getTargetDate(day || '今日');
    const pfc = {
      kcal: 0,
      P: 0,
      F: 0,
      C: 0,
      items: [{ name: '食べなかった', P: 0, F: 0, C: 0 }],
    };

    await saveFoodRecord({
      customerName: customer.name,
      lineUserId: verifiedLineUserId,
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
});
