import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId } from '@/lib/notion';
import { patchCustomer } from '@/lib/repository/customers';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId);
  if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
  await patchCustomer(customer.pageId, { onboardingCompletedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
});

export const DELETE = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId);
  if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
  await patchCustomer(customer.pageId, { onboardingCompletedAt: null });
  return NextResponse.json({ ok: true });
});
