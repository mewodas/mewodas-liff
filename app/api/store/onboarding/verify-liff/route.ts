import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIFF_ID_PATTERN = /^\d{10}-\w+$/;

export const POST = withAdminTenant(async (req: NextRequest) => {
  try {
    const { liffId } = await req.json();
    if (!liffId || typeof liffId !== 'string') {
      return NextResponse.json({ error: 'liffId 必須' }, { status: 400 });
    }
    if (!LIFF_ID_PATTERN.test(liffId.trim())) {
      return NextResponse.json(
        { error: 'LIFF ID の形式が正しくありません（例: 1234567890-AbCdEfGh）' },
        { status: 400 }
      );
    }

    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    await updateTenantRow(row.pageId, { liffId: liffId.trim() });
    invalidateTenantCache();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
