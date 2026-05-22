import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { getCurrentTenant } from '@/lib/tenant';
import { createRichMenu, deleteRichMenu, type RichMenuButtonLabels } from '@/lib/lineRichMenu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withAdminTenant(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const buttonLabels: RichMenuButtonLabels | undefined = body.buttonLabels;

    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    if (!row.lineChannelToken) {
      return NextResponse.json({ error: 'LINE Channel Token が未設定です。まずトークン検証を完了してください。' }, { status: 400 });
    }
    if (!row.liffId) {
      return NextResponse.json({ error: 'LIFF ID が未設定です。まず LIFF ID を登録してください。' }, { status: 400 });
    }

    if (row.richMenuId) {
      try {
        await deleteRichMenu(row.lineChannelToken, row.richMenuId);
      } catch {
        // 削除失敗は無視して続行（既に削除済みの可能性）
      }
    }

    const richMenuId = await createRichMenu(row.lineChannelToken, {
      liffId: row.liffId,
      tenantId: row.tenantId,
      gymName: row.name,
      buttonLabels,
    });

    await updateTenantRow(row.pageId, { richMenuId });
    invalidateTenantCache();

    return NextResponse.json({ ok: true, richMenuId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
