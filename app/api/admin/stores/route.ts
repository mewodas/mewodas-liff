import { NextResponse } from 'next/server';
import { listStoresForCurrentTenant, createStore } from '@/lib/stores';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async () => {
  try {
    const stores = await listStoresForCurrentTenant();
    return NextResponse.json({ stores });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error', stores: [] }, { status: 500 });
  }
});

export const POST = withAdminTenant(async (req) => {
  try {
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
