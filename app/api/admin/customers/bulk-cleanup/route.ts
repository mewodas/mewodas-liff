import { NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listCustomers, archiveCustomer } from '@/lib/repository/customers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STALE_DAYS = 14;

export const POST = withAdminTenant(async () => {
  try {
    const customers = await listCustomers({ noCache: true });
    const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    const stale = customers.filter(
      (c) =>
        c.foodStatus === '設定中' &&
        !c.lineUserId &&
        c.createdTime !== null &&
        new Date(c.createdTime).getTime() < cutoff
    );
    await Promise.all(stale.map((c) => archiveCustomer(c.pageId)));
    return NextResponse.json({ ok: true, deleted: stale.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
