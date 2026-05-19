// Stripe Checkout Session 作成 API（Volume Pricing 対応）
//
// 2 line_item 構造:
//   Item 1: サポート費 (¥5,500 固定, quantity=1) ※税込
//   Item 2: per-user (1 Price, Volume tiers, quantity=seats) ※税込
//           Stripe が席数に応じて自動的に Tier1/2/3 の単価を適用する
//
// 入力: { seats: number }  ※ seats >= 3 必須

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import {
  getStripe,
  getPlanTierBySeats,
  getMonthlyTotal,
  getMinSeats,
  getPerUserPriceId,
  getSupportFeePriceId,
} from '@/lib/stripe';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const seats = Number(body.seats) || 0;
  const minSeats = getMinSeats();
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

  const tier = getPlanTierBySeats(seats);
  const { supportFee, unitPrice } = getMonthlyTotal(seats);

  const supportFeePriceId = getSupportFeePriceId();
  const perUserPriceId = getPerUserPriceId();

  const origin = req.nextUrl.origin;

  // Price ID が設定されていれば既存 Price を使う（Volume tier は Stripe 側で自動計算）
  // 未設定（dev/preview）の場合は price_data inline で動作させる（tier 切替なし、フラット単価）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: any[] =
    supportFeePriceId && perUserPriceId
      ? [
          { price: supportFeePriceId, quantity: 1 },
          { price: perUserPriceId, quantity: seats },
        ]
      : [
          {
            price_data: {
              currency: 'jpy',
              product_data: { name: 'FitMeal サポート費' },
              unit_amount: supportFee,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'jpy',
              product_data: { name: `FitMeal per-user (${tier})` },
              unit_amount: unitPrice,
              recurring: { interval: 'month' },
            },
            quantity: seats,
          },
        ];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    locale: 'ja',
    line_items: lineItems,
    success_url: `${origin}/store/billing?success=1`,
    cancel_url: `${origin}/store/billing?canceled=1`,
    metadata: { tenantId: tenant.id, seats: String(seats), planTier: tier },
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenantId: tenant.id, seats: String(seats), planTier: tier },
    },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
});
