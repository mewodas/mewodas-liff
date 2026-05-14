import { NextRequest, NextResponse } from 'next/server';
import {
  listTenantRows,
  createTenantCustomerDb,
  createTenantFoodDb,
  insertTenantRow,
} from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, FITMEAL_TENANTS_PARENT_PAGE_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function genTenantId(name: string): string {
  // 英字小文字＋6桁ランダム
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 8) || 'gym';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug}_${rand}`;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const GET = withMasterOnly(async () => {
  try {
    const tenants = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    return NextResponse.json({ tenants });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withMasterOnly(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const plan = String(body.plan || '').trim();
    const ownerEmail = String(body.ownerEmail || '').trim();
    const note = String(body.note || '').trim();

    if (!name) return NextResponse.json({ error: 'ジム名必須' }, { status: 400 });
    if (!plan) return NextResponse.json({ error: 'プラン必須' }, { status: 400 });
    if (!ownerEmail || !/^[^@]+@[^@]+$/.test(ownerEmail)) {
      return NextResponse.json({ error: 'オーナーメール形式不正' }, { status: 400 });
    }

    const tenantId = genTenantId(name);

    // 1. 顧客DB自動作成
    const customerDbId = await createTenantCustomerDb(name, FITMEAL_TENANTS_PARENT_PAGE_ID);

    // 2. 食事記録DB自動作成
    const foodDbId = await createTenantFoodDb(name, FITMEAL_TENANTS_PARENT_PAGE_ID);

    // 3. テナントDBに登録
    const tenantPageId = await insertTenantRow(FITMEAL_TENANTS_DB_ID, {
      name,
      tenantId,
      plan,
      customerDbId,
      foodDbId,
      ownerEmail,
      startDate: jstToday(),
      note,
    });

    // 新規テナント追加されたのでキャッシュ無効化
    invalidateTenantCache();

    return NextResponse.json({
      ok: true,
      tenantId,
      tenantPageId,
      customerDbId,
      foodDbId,
      customerDbUrl: `https://www.notion.so/${customerDbId.replace(/-/g, '')}`,
      foodDbUrl: `https://www.notion.so/${foodDbId.replace(/-/g, '')}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
