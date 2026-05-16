import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { createInviteToken } from '@/lib/inviteToken';
import { getCustomer } from '@/lib/repository/customers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const tenant = getCurrentTenant();
  const token = createInviteToken({ customerId: id, tenantId: tenant.id });
  const liffId = tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fitmeal.jp';
  const url = liffId
    ? `https://liff.line.me/${liffId}/onboard?token=${token}`
    : `${base}/onboard?token=${token}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return NextResponse.json({ url, token, expiresAt });
});
