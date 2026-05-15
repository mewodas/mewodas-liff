import { NextRequest, NextResponse } from 'next/server';
import { updateFoodRecord } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageId, lineUserId, kcal, P, F, C, memo } = body;
    if (!pageId || !lineUserId) {
      return NextResponse.json({ error: 'pageId と lineUserId は必須です' }, { status: 400 });
    }
    if (typeof pageId !== 'string' || pageId.length < 16) {
      return NextResponse.json({ error: 'pageId が不正です' }, { status: 400 });
    }
    const patch: {
      kcal?: number;
      P?: number;
      F?: number;
      C?: number;
      memo?: string;
      correctedBy?: 'AI' | '顧客' | 'トレーナー';
    } = {};
    if (typeof kcal === 'number' && kcal >= 0) patch.kcal = Math.round(kcal);
    if (typeof P === 'number' && P >= 0) patch.P = Math.round(P * 10) / 10;
    if (typeof F === 'number' && F >= 0) patch.F = Math.round(F * 10) / 10;
    if (typeof C === 'number' && C >= 0) patch.C = Math.round(C * 10) / 10;
    if (typeof memo === 'string') patch.memo = memo.slice(0, 500);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '更新内容がありません' }, { status: 400 });
    }
    // 顧客 LIFF からの編集は「顧客」補正として記録
    patch.correctedBy = '顧客';
    await updateFoodRecord(pageId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
