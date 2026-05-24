import { NextRequest, NextResponse } from 'next/server';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { consumeToken } from '@/lib/onboardingTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, token, userId } = await req.json();

    if (!tenantId || !token || !userId) {
      return NextResponse.json({ error: 'tenantId, token, userId 必須' }, { status: 400 });
    }

    const resolvedTenantId = consumeToken(String(token));
    if (!resolvedTenantId) {
      return NextResponse.json({ error: 'トークンが無効または期限切れです' }, { status: 400 });
    }
    if (resolvedTenantId !== String(tenantId)) {
      return NextResponse.json({ error: 'テナント不一致' }, { status: 400 });
    }

    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === resolvedTenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    await updateTenantRow(row.pageId, { ownerLineUserId: String(userId) });
    invalidateTenantCache();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
