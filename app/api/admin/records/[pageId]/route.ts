import { NextResponse } from 'next/server';
import { patchRecord, archiveRecord, type RecordPatch } from '@/lib/repository/records';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const PATCH = withAdminTenant(async (req, { params }: { params: Promise<{ pageId: string }> }) => {
  try {
    const { pageId } = await params;
    const body = (await req.json()) as RecordPatch;
    const patch: RecordPatch = {};
    if (typeof body.P === 'number') patch.P = body.P;
    if (typeof body.F === 'number') patch.F = body.F;
    if (typeof body.C === 'number') patch.C = body.C;
    if (typeof body.memo === 'string') patch.memo = body.memo;
    // kcal は P×4+F×9+C×4 で自動計算（フロント側で渡されなくても算出）
    if (typeof body.kcal === 'number') {
      patch.kcal = body.kcal;
    } else if (
      typeof patch.P === 'number' &&
      typeof patch.F === 'number' &&
      typeof patch.C === 'number'
    ) {
      patch.kcal = Math.round(patch.P * 4 + patch.F * 9 + patch.C * 4);
    }
    await patchRecord(pageId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const DELETE = withAdminTenant(async (_req, { params }: { params: Promise<{ pageId: string }> }) => {
  try {
    const { pageId } = await params;
    await archiveRecord(pageId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
