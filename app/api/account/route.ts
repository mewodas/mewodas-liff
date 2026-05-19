import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, archiveCustomer } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const DELETE = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId, { force: true });
  if (!customer) return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });

  await archiveCustomer(customer.pageId);

  return NextResponse.json({ ok: true });
});
