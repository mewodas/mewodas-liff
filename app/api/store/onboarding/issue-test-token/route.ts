import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getCurrentTenant } from '@/lib/tenant';
import { issueToken } from '@/lib/onboardingTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (_req: NextRequest) => {
  try {
    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    if (!row.liffId) {
      return NextResponse.json({ error: 'LIFF ID が未設定です' }, { status: 400 });
    }

    const token = issueToken(tenantId);
    const testUrl = `https://liff.line.me/${row.liffId}/home/onboard-test?tenantId=${tenantId}&t=${token}`;

    return NextResponse.json({ ok: true, token, testUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
