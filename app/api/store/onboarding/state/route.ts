import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminTenant(async (req: NextRequest) => {
  try {
    const session = currentSession(req);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    return NextResponse.json({
      step: row.onboardingStep ?? 0,
      liffId: row.liffId ?? null,
      channelTokenVerified: !!row.lineChannelToken,
      richMenuId: row.richMenuId ?? null,
      ownerLineUserId: row.ownerLineUserId ?? null,
      onboardingCompletedAt: row.onboardingCompletedAt ?? null,
      gymName: row.name,
      tenantId: row.tenantId,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withAdminTenant(async (req: NextRequest) => {
  try {
    const session = currentSession(req);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json();
    const step = typeof body.step === 'number' ? body.step : null;

    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    const patch: Parameters<typeof updateTenantRow>[1] = {};
    if (step !== null) patch.onboardingStep = step;
    if (body.complete === true) {
      patch.onboardingCompletedAt = new Date().toISOString();
      patch.onboardingStep = 5;
    }

    if (Object.keys(patch).length > 0) {
      await updateTenantRow(row.pageId, patch);
      invalidateTenantCache();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
