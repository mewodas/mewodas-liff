import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import type { TenantConfig } from '@/lib/tenant';
import { runInTenantContext } from '@/lib/tenantContext';
import { computeAndStoreTenantRisk } from '@/lib/customerRiskService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type TenantRow = Awaited<ReturnType<typeof listTenantRows>>[number];

function tenantToConfig(r: TenantRow): TenantConfig {
  return {
    id: r.tenantId,
    name: r.name,
    notionApiKey: process.env.NOTION_API_KEY || '',
    notionCustomerDbId: r.customerDbId!,
    notionFoodDbId: r.foodDbId!,
    notionWeightDbId: r.weightDbId ?? undefined,
    driveFolderId: process.env.DRIVE_PARENT_FOLDER_ID,
    geminiApiKey: process.env.GEMINI_API_KEY,
    gasEndpoint: process.env.GAS_RECORD_ENDPOINT,
    liffId: r.liffId ?? undefined,
    lineChannelToken: r.lineChannelToken ?? undefined,
    lineAutoSendEnabled: r.lineAutoSendEnabled,
    autoSendTime: r.autoSendTime ?? undefined,
    themeColor: '#059669',
    defaultGoals: { kcal: 2000, P: 100, F: 56, C: 275 },
  };
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();

  const allTenantRows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const activeTenants = allTenantRows.filter(
    (r) => r.status !== '解約' && r.customerDbId && r.foodDbId
  );

  const results: Array<{
    tenantId: string;
    name: string;
    status: string;
    error?: string;
  }> = [];

  for (const tenantRow of activeTenants) {
    const config = tenantToConfig(tenantRow);
    try {
      await runInTenantContext(config, () => computeAndStoreTenantRisk());
      results.push({ tenantId: tenantRow.tenantId, name: tenantRow.name, status: 'ok' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error(`[compute-customer-risk] tenant=${tenantRow.tenantId} failed`, err);
      results.push({
        tenantId: tenantRow.tenantId,
        name: tenantRow.name,
        status: 'error',
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    tenants: results.length,
    results,
  });
}
