import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { updateTenantRow, listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 現在テナントの SaaS 運用設定を取得・更新する。
// 現状は招待モード（individual / approval）のみ。
// 拡張予定: 自動承認・通知設定など。

export const GET = withAdminTenant(async () => {
  const tenant = getCurrentTenant();
  return NextResponse.json({
    tenantId: tenant.id,
    tenantName: tenant.name,
    inviteMode: tenant.inviteMode ?? 'individual',
  });
});

export const PATCH = withAdminTenant(async (req: NextRequest) => {
  let body: { inviteMode?: 'individual' | 'approval' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const inviteMode = body.inviteMode;
  if (inviteMode !== 'individual' && inviteMode !== 'approval') {
    return NextResponse.json(
      { error: 'inviteMode は "individual" または "approval" のみ指定可能です' },
      { status: 400 }
    );
  }

  const tenant = getCurrentTenant();
  // Notion テナント DB を更新するために pageId が必要
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const row = rows.find((r) => r.tenantId === tenant.id);
  if (!row) {
    return NextResponse.json({ error: 'tenant_not_found_in_notion' }, { status: 404 });
  }

  await updateTenantRow(row.pageId, { inviteMode });
  invalidateTenantCache();

  return NextResponse.json({ ok: true, tenantId: tenant.id, inviteMode });
});
