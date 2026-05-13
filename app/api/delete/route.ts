import { NextRequest, NextResponse } from 'next/server';
import { deleteFoodRecord } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageId, lineUserId } = body;
    if (!pageId || !lineUserId) {
      return NextResponse.json({ error: 'pageId と lineUserId は必須です' }, { status: 400 });
    }
    // 簡易チェック：pageIdの形式
    if (typeof pageId !== 'string' || pageId.length < 16) {
      return NextResponse.json({ error: 'pageId が不正です' }, { status: 400 });
    }
    await deleteFoodRecord(pageId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
