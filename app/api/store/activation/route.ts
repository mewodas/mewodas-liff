import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { listTenantRows, hasAnyFoodRecordSince } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, getCurrentTenant } from '@/lib/tenant';
import { listCustomers } from '@/lib/repository/customers';
import { getCached, setCached } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export type ActivationState = {
  gymName: string;
  tenantId: string;
  /** LINE連携（LIFF + チャネルトークン）が完了しているか */
  liffConnected: boolean;
  /** オンボーディング・ウィザードを完了済みか */
  onboardingCompleted: boolean;
  /** お客様用の友だち追加URL（未連携なら null） */
  inviteUrl: string | null;
  /** 登録済み顧客数 */
  customerCount: number;
  /** 過去180日に食事記録が1件以上あるか */
  hasFirstRecord: boolean;
};

// 友だち追加URL（officialLineUrl）が無くても、トークン未連携を案内できるよう null を許容。
export const GET = withAdminTenant(async (req: NextRequest) => {
  try {
    const session = currentSession(req);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const tenantId = getCurrentTenant().id;
    const cacheKey = `${tenantId}:store:activation`;
    const cached = getCached<ActivationState>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    const customers = await listCustomers();
    const customerCount = customers.length;

    // 記録ありの判定は顧客が居る場合のみ問い合わせ（無駄な Notion クエリを避ける）
    let hasFirstRecord = false;
    if (customerCount > 0) {
      const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      try {
        hasFirstRecord = await hasAnyFoodRecordSince(since);
      } catch {
        hasFirstRecord = false;
      }
    }

    const state: ActivationState = {
      gymName: row.name,
      tenantId: row.tenantId,
      liffConnected: !!(row.liffId && row.lineChannelToken),
      onboardingCompleted: !!row.onboardingCompletedAt,
      inviteUrl: row.officialLineUrl ?? null,
      customerCount,
      hasFirstRecord,
    };

    setCached(cacheKey, state, 60_000);
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
