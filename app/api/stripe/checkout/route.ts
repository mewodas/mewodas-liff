// Stripe Checkout Session 作成 API（プラン定義対応）
//
// 入力: { seats: number, planCode?: string }  ※ seats >= minSeats 必須
// planCode 未指定時は 'standard' にフォールバック

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import {
  getStripe,
  buildSubscriptionLineItems,
} from '@/lib/stripe';
import { listTenantRows, getPlanByCode } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const seats = Number(body.seats) || 0;
  const planCode = String(body.planCode || 'standard');

  const plan = await getPlanByCode(planCode);
  if (!plan) {
    return NextResponse.json({ error: `プラン '${planCode}' が見つかりません` }, { status: 404 });
  }

  const minSeats = plan.minSeats;
  if (seats < minSeats) {
    return NextResponse.json({ error: `席数は${minSeats}名以上必須` }, { status: 400 });
  }

  const tenant = getCurrentTenant();
  const stripe = getStripe();

  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRow = rows.find((r) => r.tenantId === tenant.id);
  if (!tenantRow) {
    return NextResponse.json({ error: 'テナント未登録' }, { status: 404 });
  }

  let stripeCustomerId = tenantRow.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: tenantRow.ownerEmail || undefined,
      name: tenantRow.name,
      metadata: { tenantId: tenant.id },
    });
    stripeCustomerId = customer.id;
  }

  const lineItems = buildSubscriptionLineItems(plan, seats);
  const origin = req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    locale: 'ja',
    line_items: lineItems,
    success_url: `${origin}/store/billing?success=1`,
    cancel_url: `${origin}/store/billing?canceled=1`,
    metadata: { tenantId: tenant.id, seats: String(seats), planCode },
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenantId: tenant.id, seats: String(seats), planCode },
    },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
});
