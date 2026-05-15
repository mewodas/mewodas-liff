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

function genStoreId(): string {
  return 'store_' + Math.random().toString(36).slice(2, 8);
}

export const POST = withAdminTenant(async (req) => {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: '店舗名必須' }, { status: 400 });
    // storeId は省略時に自動生成（英数字スラッグが取れない日本語名にも対応）
    let storeId = String(body.storeId || '').trim();
    if (!storeId) storeId = genStoreId();
    else if (!/^[a-z0-9_-]+$/i.test(storeId)) {
      return NextResponse.json({ error: '店舗IDは英数字・ハイフン・アンダースコアのみ' }, { status: 400 });
    }
    // 署名は省略時に店舗名をそのまま使う
    const signature = body.signature ? String(body.signature) : name;
    const store = await createStore({
      name,
      storeId,
      address: body.address ? String(body.address) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      hours: body.hours ? String(body.hours) : undefined,
      manager: body.manager ? String(body.manager) : undefined,
      signature,
    });
    return NextResponse.json({ ok: true, store });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
