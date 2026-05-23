import { NextRequest, NextResponse } from 'next/server';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';
import { provisionTenant } from '@/lib/provisionTenant';
import { FITMEAL_STORES_DB_ID } from '@/lib/stores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    // admin 手動作成は billingMode を明示しない (既存 admin 挙動を踏襲)。
    // selfServe=false でログイン情報メール (welcomeEmail ではなく loginInfoEmail) を使う。
    const result = await provisionTenant({
      name,
      ownerEmail,
      plan,
      note,
      selfServe: false,
    });

    return NextResponse.json({
      ok: true,
      tenantId: result.tenantId,
      tenantPageId: result.tenantPageId,
      customerDbId: result.customerDbId,
      foodDbId: result.foodDbId,
      defaultStoreId: result.defaultStoreId,
      mail: result.mail,
      initialPassword: result.initialPassword,
      customerDbUrl: `https://www.notion.so/${result.customerDbId.replace(/-/g, '')}`,
      foodDbUrl: `https://www.notion.so/${result.foodDbId.replace(/-/g, '')}`,
      weightDbUrl: `https://www.notion.so/${result.weightDbId.replace(/-/g, '')}`,
      storesDbUrl: `https://www.notion.so/${FITMEAL_STORES_DB_ID.replace(/-/g, '')}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
