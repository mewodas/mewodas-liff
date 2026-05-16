// Stripe Customer Portal リンク生成
//
// 顧客がクレカ変更・解約・請求書履歴を確認するための Portal URL を返す。

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { getStripe } from '@/lib/stripe';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const tenant = getCurrentTenant();
  const stripe = getStripe();

  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRow = rows.find((r) => r.tenantId === tenant.id);
  if (!tenantRow?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'まだ決済が完了していません。先に課金設定をしてください。' },
      { status: 400 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenantRow.stripeCustomerId,
    return_url: `${req.nextUrl.origin}/store/billing`,
  });

  return NextResponse.json({ url: session.url });
});
