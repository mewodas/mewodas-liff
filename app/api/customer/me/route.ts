import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withLiffTenant(async (req: NextRequest) => {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) return NextResponse.json({ error: 'lineUserId required' }, { status: 400 });
  const customer = await getCustomerByLineId(lineUserId, { force: true });
  if (!customer) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ customer });
});
