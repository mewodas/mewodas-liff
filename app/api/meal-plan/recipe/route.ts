import { NextRequest, NextResponse } from 'next/server';
import { generateRecipe } from '@/lib/gemini';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// 認証必須: 検証済み LINE ID トークンが無いと 401 を返す。
// 認証なしだと Gemini API コストを外部から無制限に消費されるため。
// レシピ生成自体はテナント非依存なので verifiedLineUserId / tenant は使わない。
export const POST = withLiffTenant(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { title, items, servings } = body;
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title が必要です' }, { status: 400 });
    }
    const itemList: string[] = Array.isArray(items)
      ? items.map((s) => String(s)).filter(Boolean)
      : [];
    const recipe = await generateRecipe({
      title,
      items: itemList,
      servings: typeof servings === 'string' ? servings : '1人前',
    });
    return NextResponse.json({ recipe });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
