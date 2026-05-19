// Stripe Checkout Session 作成 API
//
// 初回購入フロー:
//   1. テナント管理画面から POST /api/stripe/checkout
//   2. body: { plan, customerCount, billingCycle }
//   3. Stripe Checkout Session 作成 → URL を返す
//   4. クライアントが URL に遷移してカード入力
//   5. 完了 → webhook で Notion 更新

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { getStripe, monthlyPriceFor, annualPriceFor } from '@/lib/stripe';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const customerCount = Number(body.customerCount) || 0;
  const billingCycle = (body.billingCycle as '月払い' | '年払い') || '月払い';
  if (customerCount <= 0) {
    return NextResponse.json({ error: '顧客数 1 以上必須' }, { status: 400 });
  }

  const tenant = getCurrentTenant();
  const stripe = getStripe();

  // 現テナントレコードから既存 Stripe Customer ID を取得
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRow = rows.find((r) => r.tenantId === tenant.id);
  if (!tenantRow) {
    return NextResponse.json({ error: 'テナント未登録' }, { status: 404 });
  }

  let stripeCustomerId = tenantRow.stripeCustomerId;
  if (!stripeCustomerId) {
    // 新規 Stripe Customer 作成
    const customer = await stripe.customers.create({
      email: tenantRow.ownerEmail || undefined,
      name: tenantRow.name,
      metadata: { tenantId: tenant.id },
    });
    stripeCustomerId = customer.id;
  }

  // 料金算出
  const totalAmount =
    billingCycle === '年払い'
      ? annualPriceFor(customerCount)
      : monthlyPriceFor(customerCount);

  // Stripe Checkout Session 作成（Subscription mode）
  const origin = req.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    locale: 'ja',
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `FitMeal ${customerCount}名プラン（${billingCycle}）`,
            description: `1人あたり ${billingCycle === '年払い' ? '年' : '月'}額自動計算`,
          },
          unit_amount: totalAmount,
          recurring: {
            interval: billingCycle === '年払い' ? 'year' : 'month',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/store/billing?success=1`,
    cancel_url: `${origin}/store/billing?canceled=1`,
    metadata: { tenantId: tenant.id, customerCount: String(customerCount), billingCycle },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
});
