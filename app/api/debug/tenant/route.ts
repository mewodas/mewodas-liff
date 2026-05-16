// 診断用: 現在のテナント解決状態を返す（一時的）
// 削除予定: 原因特定後に削除
import { NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = getCurrentTenant();
  return NextResponse.json({
    currentTenant: {
      id: t.id,
      name: t.name,
      customerDbId: t.notionCustomerDbId?.slice(0, 8) + '...',
      foodDbId: t.notionFoodDbId?.slice(0, 8) + '...',
      liffId: t.liffId,
    },
    env: {
      FITMEAL_TENANT_ID_OVERRIDE: process.env.FITMEAL_TENANT_ID_OVERRIDE || '(empty)',
      NOTION_CUSTOMER_DB_ID: process.env.NOTION_CUSTOMER_DB_ID?.slice(0, 8) + '...' || '(empty)',
      NOTION_FOOD_DB_ID: process.env.NOTION_FOOD_DB_ID?.slice(0, 8) + '...' || '(empty)',
      NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID || '(empty)',
      FITMEAL_TENANTS_DB_ID: process.env.FITMEAL_TENANTS_DB_ID?.slice(0, 8) + '...' || '(empty)',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(empty)',
      VERCEL_ENV: process.env.VERCEL_ENV || '(empty)',
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || '(empty)',
    },
    expected: {
      tenantId: 'mewodas-staging',
      customerDbId: '31cbec9f...',
      foodDbId: '5ee5841e...',
      liffId: '2010102869-cH37kLJU',
    },
  });
}
