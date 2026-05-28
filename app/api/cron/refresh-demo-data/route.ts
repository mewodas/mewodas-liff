// デモ/サンプル顧客の食事・体重・個人シートを今日基準にリフレッシュする cron ルート。
//
// 毎日 JST 04:00 (UTC 19:00) に Vercel Cron が呼び出す。
// 全テナントを走査し、SAMPLE_ / DEMO_ プレフィックスの顧客を持つテナントの記録を
// 今日基準の直近7日に作り直す。
//
// 認証: update-calibrations と同じ checkCronAuth（Authorization: Bearer CRON_SECRET）。

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { refreshDemoDataForTenant } from '@/lib/refreshDemoData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PARENT_PAGE_ID =
  process.env.FITMEAL_TENANTS_PARENT_PAGE_ID || '34ea47a8738d8155a2b1e9f4607e8986';

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  const notionApiKey = process.env.NOTION_API_KEY || '';

  if (!notionApiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY not configured' }, { status: 503 });
  }

  const allTenants = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const targets = allTenants.filter(
    (t) => t.status !== '解約' && t.customerDbId && t.foodDbId && t.weightDbId
  );

  const results = [];

  for (const t of targets) {
    try {
      const result = await refreshDemoDataForTenant(
        t.tenantId,
        {
          customerDbId: t.customerDbId!,
          foodDbId: t.foodDbId!,
          weightDbId: t.weightDbId!,
        },
        notionApiKey,
        PARENT_PAGE_ID
      );
      if (result.customersProcessed > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[refresh-demo-data] ${t.tenantId} (${t.name}): ${result.customersProcessed} customers refreshed, food=${result.foodArchived} archived, weight=${result.weightArchived} archived, sheetRebuilt=${result.sheetRebuilt}`
        );
      }
      results.push({ ...result, tenantName: t.name });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown error';
      // eslint-disable-next-line no-console
      console.error(`[refresh-demo-data] ${t.tenantId} (${t.name}): ERROR ${message}`);
      results.push({
        tenantId: t.tenantId,
        tenantName: t.name,
        customersProcessed: 0,
        foodArchived: 0,
        weightArchived: 0,
        sheetRebuilt: false,
        error: message,
      });
    }
  }

  const refreshed = results.filter((r) => r.customersProcessed > 0).length;
  const skipped = results.filter((r) => r.customersProcessed === 0 && !r.error).length;
  const errors = results.filter((r) => !!r.error).length;

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    processed: results.length,
    refreshed,
    skipped,
    errors,
    results,
  });
}
