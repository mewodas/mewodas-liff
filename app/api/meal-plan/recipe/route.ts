import { NextRequest, NextResponse } from 'next/server';
import { generateRecipe } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
}
