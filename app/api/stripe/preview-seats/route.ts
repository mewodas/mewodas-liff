// 席数変更時の日割り差額プレビュー API
//
// GET /api/stripe/preview-seats?seats=N
// 現在の Subscription に対して createPreview を取得し差額を返す

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { getStripe, getPlanTierBySeats, getMinSeats, getPerUserPriceId } from '@/lib/stripe';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminTenant(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const newSeats = Number(searchParams.get('seats'));
  if (!newSeats || newSeats < getMinSeats()) {
    return NextResponse.json({ error: `席数は${getMinSeats()}名以上必須` }, { status: 400 });
  }

  const tenant = getCurrentTenant();
  const stripe = getStripe();

  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRow = rows.find((r) => r.tenantId === tenant.id);
  if (!tenantRow?.stripeSubscriptionId) {
    return NextResponse.json({ error: '契約なし' }, { status: 400 });
  }

  const sub = await stripe.subscriptions.retrieve(tenantRow.stripeSubscriptionId, {
    expand: ['items.data.price'],
  });

  const perUserPriceIds = new Set(
    [
      process.env.STRIPE_PRICE_PER_USER,
      process.env.STRIPE_PRICE_STARTER_PER_USER,
      process.env.STRIPE_PRICE_GROWTH_PER_USER,
      process.env.STRIPE_PRICE_SCALE_PER_USER,
    ].filter(Boolean) as string[]
  );
  const supportFeePriceId = process.env.STRIPE_PRICE_SUPPORT_FEE;

  let perUserItemId: string | null = null;
  for (const item of sub.items.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    if (perUserPriceIds.size > 0 && perUserPriceIds.has(priceId)) {
      perUserItemId = item.id;
      break;
    }
    if (supportFeePriceId && priceId !== supportFeePriceId) {
      perUserItemId = item.id;
    }
  }

  if (!perUserItemId) {
    return NextResponse.json({ error: 'per-user item が見つかりません' }, { status: 400 });
  }

  const newTier = getPlanTierBySeats(newSeats);
  const newPriceId = getPerUserPriceId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemUpdate: Record<string, any> = {
    id: perUserItemId,
    quantity: newSeats,
  };
  if (newPriceId) {
    itemUpdate.price = newPriceId;
  }

  try {
    const invoice = await stripe.invoices.createPreview({
      subscription: tenantRow.stripeSubscriptionId,
      subscription_details: {
        items: [itemUpdate],
        proration_behavior: 'create_prorations',
      },
    });

    const amountDue = invoice.amount_due;
    return NextResponse.json({
      amountDue,
      newSeats,
      newTier,
      currency: invoice.currency,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
