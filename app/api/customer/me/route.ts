import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId, { force: true });
  if (!customer) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // DEBUG (staging only): tourResetAt の値を Vercel logs に出力
  // eslint-disable-next-line no-console
  console.log('[customer/me] DEBUG:', JSON.stringify({
    lineUserId: verifiedLineUserId,
    pageId: customer.pageId,
    name: customer.name,
    tourResetAt: customer.tourResetAt,
    onboardingCompletedAt: customer.onboardingCompletedAt,
  }));
  return NextResponse.json({ customer });
});
