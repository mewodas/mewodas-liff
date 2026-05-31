import { NextRequest, NextResponse } from 'next/server';
import { updateFoodRecord, assertFoodRecordOwnership } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';
import { logAuditEvent } from '@/lib/auditLog';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { pageId, kcal, P, F, C, memo } = body;
    if (!pageId) {
      return NextResponse.json({ error: 'pageId は必須です' }, { status: 400 });
    }
    if (typeof pageId !== 'string' || pageId.length < 16) {
      return NextResponse.json({ error: 'pageId が不正です' }, { status: 400 });
    }
    await assertFoodRecordOwnership(pageId, verifiedLineUserId);
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
    patch.correctedBy = '顧客';
    await updateFoodRecord(pageId, patch);

    logAuditEvent({
      action: 'meal.update',
      outcome: 'success',
      actorType: 'customer',
      actorId: verifiedLineUserId,
      tenantId: getCurrentTenant().id,
      targetType: 'meal_record',
      targetId: pageId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('forbidden:')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
