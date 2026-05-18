// 席数変更確定 API
//
// POST /api/stripe/update-seats
// body: { seats: number }
// Stripe Subscription の per-user item quantity を更新する

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import {
  getStripe,
  getPlanTierBySeats,
  getPriceIdForTier,
  getMinSeats,
} from '@/lib/stripe';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getSeatStatus } from '@/lib/seats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const newSeats = Number(body.seats);
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

  // 減枠ガード: 現使用席数より少ない枠は不可
  const seatStatus = await getSeatStatus({ noCache: true });
  if (newSeats < seatStatus.currentSeats) {
    return NextResponse.json(
      {
        error: `使用中の席数（${seatStatus.currentSeats}名）より少ない枠には変更できません`,
        currentSeats: seatStatus.currentSeats,
      },
      { status: 400 }
    );
  }

  const sub = await stripe.subscriptions.retrieve(tenantRow.stripeSubscriptionId, {
    expand: ['items.data.price'],
  });

  const perUserPriceIds = new Set(
    [
      process.env.STRIPE_PRICE_STARTER_PER_USER,
      process.env.STRIPE_PRICE_GROWTH_PER_USER,
      process.env.STRIPE_PRICE_SCALE_PER_USER,
    ].filter(Boolean) as string[]
  );

  let perUserItemId: string | null = null;
  let currentPriceId: string | null = null;
  for (const item of sub.items.data) {
    if (perUserPriceIds.size === 0 || (item.price?.id && perUserPriceIds.has(item.price.id))) {
      perUserItemId = item.id;
      currentPriceId = item.price?.id ?? null;
      break;
    }
  }

  if (!perUserItemId) {
    return NextResponse.json({ error: 'per-user item が見つかりません' }, { status: 400 });
  }

  const newTier = getPlanTierBySeats(newSeats);
  const newPriceId = getPriceIdForTier(newTier);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemUpdate: Record<string, any> = {
    id: perUserItemId,
    quantity: newSeats,
  };
  if (newPriceId && currentPriceId && newPriceId !== currentPriceId) {
    itemUpdate.price = newPriceId;
  }

  await stripe.subscriptions.update(tenantRow.stripeSubscriptionId, {
    items: [itemUpdate],
    proration_behavior: 'create_prorations',
    metadata: { seats: String(newSeats), planTier: newTier },
  });

  return NextResponse.json({ ok: true, newSeats, newTier });
});
