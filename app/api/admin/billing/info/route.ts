// 現テナントの課金情報を返す API

import { NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminTenant(async () => {
  const tenant = getCurrentTenant();
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const t = rows.find((r) => r.tenantId === tenant.id);
  if (!t) {
    return NextResponse.json({ error: 'テナント未登録' }, { status: 404 });
  }
  return NextResponse.json({
    tenantName: t.name,
    ownerEmail: t.ownerEmail,
    plan: t.plan,
    customerCount: t.customerCount,
    monthlyPrice: t.monthlyPrice,
    billingCycle: t.billingCycle,
    nextBillingDate: t.nextBillingDate,
    paymentStatus: t.paymentStatus,
    hasStripeCustomer: !!t.stripeCustomerId,
  });
});
