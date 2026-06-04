import { NextResponse } from 'next/server';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { invalidate } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 運営(master)がテナントの店舗オンボーディングをリセットする。
// 顧客側のツアーリセット（DELETE /api/admin/customers/[id]/onboarding）と同じ思想。
// onboardingStep と onboardingCompletedAt のみ初期化し、LIFF ID / チャネルトークン /
// リッチメニュー等の実設定は保持する（再度ウィザードを出すだけ・連携は壊さない）。
export const DELETE = withMasterOnly(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const tenant = all.find((t) => t.pageId === id || t.tenantId === id);
    if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    await updateTenantRow(tenant.pageId, { onboardingStep: 0, onboardingCompletedAt: null });
    invalidateTenantCache();
    invalidate(`${tenant.tenantId}:store:`); // /store/start のアクティベーションキャッシュも無効化

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
