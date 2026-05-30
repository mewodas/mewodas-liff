import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import {
  listCustomerRiskByTenant,
  latestComputedAt,
} from '@/lib/repository/customerRisk';
import { computeAndStoreTenantRisk } from '@/lib/customerRiskService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

const currentEnv =
  process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development';

export const GET = withAdminTenant(async (_req: NextRequest) => {
  const tenant = getCurrentTenant();
  const tenantId = tenant.id;

  const [rows, lastAt] = await Promise.all([
    listCustomerRiskByTenant(tenantId, currentEnv),
    latestComputedAt(tenantId, currentEnv),
  ]);

  const isStale =
    !lastAt ||
    Date.now() - new Date(lastAt).getTime() > STALE_THRESHOLD_MS;

  if (isStale) {
    try {
      waitUntil(computeAndStoreTenantRisk());
    } catch {
      // waitUntil がコンテキスト外で throw する場合のフォールバック
    }
  }

  return NextResponse.json({
    rows: rows.map((r) => ({
      customerPageId: r.customerPageId,
      lineUserId: r.lineUserId,
      noRecord: r.noRecord,
      daysSinceLastRecord: r.daysSinceLastRecord,
      weightStalled: r.weightStalled,
    })),
  });
});
