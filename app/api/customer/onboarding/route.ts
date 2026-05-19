import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId } from '@/lib/notion';
import { patchCustomer } from '@/lib/repository/customers';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withLiffTenant(async (req: NextRequest) => {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) return NextResponse.json({ error: 'lineUserId required' }, { status: 400 });
  const customer = await getCustomerByLineId(lineUserId);
  if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
  await patchCustomer(customer.pageId, { onboardingCompletedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
});

export const DELETE = withLiffTenant(async (req: NextRequest) => {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) return NextResponse.json({ error: 'lineUserId required' }, { status: 400 });
  const customer = await getCustomerByLineId(lineUserId);
  if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
  await patchCustomer(customer.pageId, { onboardingCompletedAt: null });
  return NextResponse.json({ ok: true });
});
