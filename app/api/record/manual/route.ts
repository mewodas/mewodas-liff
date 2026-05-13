import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// AI解析を経ずに、提示されたPFCをそのまま記録するエンドポイント
// 「これ食べた」ワンタップ記録用（AI提案/食品DB/バーコード/よく食べる、共通）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, mealType, title, kcal, P, F, C, day, source } = body;

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

    // sourceに応じて記録のラベルを切り替える（食事タイトルの末尾に付与）
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

    const targetDate = getTargetDate(day || '今日');
    // 表示用タイトル：食事名 ｜ 登録元
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
      lineUserId,
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
}
