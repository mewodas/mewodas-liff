// 診断用: createWeightLog を直接実行してエラー詳細を返す（一時的）
import { NextResponse } from 'next/server';
import { createWeightLog } from '@/lib/repository/weightLogs';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const tenant = getCurrentTenant();
  try {
    const result = await createWeightLog({
      lineUserId: 'DIAGNOSTIC_USER',
      customerName: '診断',
      date: '2026-05-17',
      weightKg: 99.9,
      source: 'LIFF',
    });
    return NextResponse.json({
      ok: true,
      result,
      tenant: {
        id: tenant.id,
        weightDbId: tenant.notionWeightDbId,
        hasApiKey: !!tenant.notionApiKey,
      },
      env: {
        NOTION_WEIGHT_DB_ID: process.env.NOTION_WEIGHT_DB_ID || '(empty)',
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
      },
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      tenant: {
        id: tenant.id,
        weightDbId: tenant.notionWeightDbId,
        hasApiKey: !!tenant.notionApiKey,
      },
      env: {
        NOTION_WEIGHT_DB_ID: process.env.NOTION_WEIGHT_DB_ID || '(empty)',
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
      },
    });
  }
}
