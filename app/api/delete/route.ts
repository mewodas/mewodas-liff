import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { deleteFoodRecord, assertFoodRecordOwnership } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';
import { logAuditEvent } from '@/lib/auditLog';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { pageId } = body;
    if (!pageId) {
      return NextResponse.json({ error: 'pageId は必須です' }, { status: 400 });
    }
    if (typeof pageId !== 'string' || pageId.length < 16) {
      return NextResponse.json({ error: 'pageId が不正です' }, { status: 400 });
    }
    await assertFoodRecordOwnership(pageId);
    waitUntil(deleteFoodRecord(pageId).catch((err) => console.error('deleteFoodRecord failed:', err)));

    logAuditEvent({
      action: 'meal.delete',
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
