import { NextResponse } from 'next/server';
import { listStoresByTenantId, createStore } from '@/lib/stores';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// URL の id が tenant pageId or tenantId 文字列のいずれかを受ける
async function resolveTenantId(id: string): Promise<string | null> {
  if (!id.includes('-') && id.length !== 32) {
    // 既に tenantId 文字列の可能性
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const t = all.find((x) => x.tenantId === id);
    return t?.tenantId || null;
  }
  // pageId なのでテナント DB から tenantId を引く
  const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const t = all.find((x) => x.pageId === id);
  return t?.tenantId || null;
}

export const GET = withMasterOnly(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const tenantId = await resolveTenantId(id);
    if (!tenantId) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    const stores = await listStoresByTenantId(tenantId);
    return NextResponse.json({ stores, tenantId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withMasterOnly(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const tenantId = await resolveTenantId(id);
    if (!tenantId) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    const body = await req.json();
    const name = String(body.name || '').trim();
    const storeId = String(body.storeId || '').trim();
    if (!name) return NextResponse.json({ error: '店舗名必須' }, { status: 400 });
    if (!storeId) return NextResponse.json({ error: '店舗ID必須' }, { status: 400 });
    if (!/^[a-z0-9_-]+$/i.test(storeId)) {
      return NextResponse.json({ error: '店舗IDは英数字・ハイフン・アンダースコアのみ' }, { status: 400 });
    }
    const store = await createStore({
      name,
      storeId,
      tenantId,
      address: body.address ? String(body.address) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      hours: body.hours ? String(body.hours) : undefined,
      manager: body.manager ? String(body.manager) : undefined,
      signature: body.signature ? String(body.signature) : undefined,
    });
    return NextResponse.json({ ok: true, store });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
