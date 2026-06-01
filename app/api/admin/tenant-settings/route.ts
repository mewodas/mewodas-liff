import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { updateTenantRow, listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminTenant(async () => {
  const tenant = getCurrentTenant();
  return NextResponse.json({
    tenantId: tenant.id,
    tenantName: tenant.name,
    inviteMode: tenant.inviteMode ?? 'individual',
    riskAlertEnabled: tenant.riskAlertEnabled ?? false,
  });
});

export const PATCH = withAdminTenant(async (req: NextRequest) => {
  let body: { inviteMode?: 'individual' | 'approval'; riskAlertEnabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: { inviteMode?: 'individual' | 'approval'; riskAlertEnabled?: boolean } = {};

  if (body.inviteMode !== undefined) {
    if (body.inviteMode !== 'individual' && body.inviteMode !== 'approval') {
      return NextResponse.json(
        { error: 'inviteMode は "individual" または "approval" のみ指定可能です' },
        { status: 400 }
      );
    }
    patch.inviteMode = body.inviteMode;
  }

  if (body.riskAlertEnabled !== undefined) {
    patch.riskAlertEnabled = !!body.riskAlertEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 });
  }

  const tenant = getCurrentTenant();
  // pageId は解決済みテナント（resolver の5分メモリキャッシュ）から取得し、全テナントDBの
  // 再クエリ（毎回 Notion 往復）を回避してトグル保存を高速化。未設定時のみ従来クエリにフォールバック。
  let pageId = tenant.notionPageId;
  if (!pageId) {
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    pageId = rows.find((r) => r.tenantId === tenant.id)?.pageId;
  }
  if (!pageId) {
    return NextResponse.json({ error: 'tenant_not_found_in_notion' }, { status: 404 });
  }

  await updateTenantRow(pageId, patch);
  invalidateTenantCache();

  return NextResponse.json({
    ok: true,
    tenantId: tenant.id,
    ...patch,
  });
});
