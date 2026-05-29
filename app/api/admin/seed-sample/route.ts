// サンプル顧客シード（staging検証用・master only）
//
// 使い方: POST /api/admin/seed-sample
// 対象テナントの顧客DB/食事DB/体重DBにサンプル顧客を1名投入する。
// 既に SAMPLE_ 顧客が存在する場合はスキップ。

import { NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { seedSampleCustomer } from '@/lib/provisionTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async () => {
  const tenant = getCurrentTenant();
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const row = rows.find((r) => r.tenantId === tenant.id);
  if (!row) {
    return NextResponse.json({ error: 'テナント未登録' }, { status: 404 });
  }
  if (!row.customerDbId || !row.foodDbId || !row.weightDbId) {
    return NextResponse.json({ error: 'DB ID が未設定です' }, { status: 400 });
  }
  const notionApiKey = process.env.NOTION_API_KEY || '';
  if (!notionApiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY 未設定' }, { status: 500 });
  }
  try {
    await seedSampleCustomer(
      tenant.id,
      { customerDbId: row.customerDbId, foodDbId: row.foodDbId, weightDbId: row.weightDbId, bodyCompDbId: row.bodyCompDbId || '' },
      notionApiKey
    );
    return NextResponse.json({ ok: true, tenantId: tenant.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'シード失敗' },
      { status: 500 }
    );
  }
});
