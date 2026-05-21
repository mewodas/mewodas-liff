// 席数・プラン変更確定 API
//
// POST /api/stripe/update-seats
// body: { seats: number, planCode?: string }
// Stripe Subscription の per-user item quantity / price を更新する

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import {
  getStripe,
  buildSubscriptionLineItems,
} from '@/lib/stripe';
import { listTenantRows, getPlanByCode, listPlans } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getSeatStatus } from '@/lib/seats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const newSeats = Number(body.seats);
  const planCodeInput = body.planCode as string | undefined;

  const tenant = getCurrentTenant();
  const stripe = getStripe();

  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRow = rows.find((r) => r.tenantId === tenant.id);
  if (!tenantRow?.stripeSubscriptionId) {
    return NextResponse.json({ error: '契約なし' }, { status: 400 });
  }

  // プラン解決: 指定 planCode → テナントの planCode → 'standard'
  const effectivePlanCode = planCodeInput || tenantRow.planCode || 'standard';
  const plan = await getPlanByCode(effectivePlanCode);
  if (!plan) {
    return NextResponse.json({ error: `プラン '${effectivePlanCode}' が見つかりません` }, { status: 404 });
  }

  if (!newSeats || newSeats < plan.minSeats) {
    return NextResponse.json({ error: `席数は${plan.minSeats}名以上必須` }, { status: 400 });
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

  // 全プラン定義 + env からの per-user Price ID 集合
  const perUserPriceIds = new Set(
    [
      process.env.STRIPE_PRICE_PER_USER,
      process.env.STRIPE_PRICE_STARTER_PER_USER,
      process.env.STRIPE_PRICE_GROWTH_PER_USER,
      process.env.STRIPE_PRICE_SCALE_PER_USER,
    ].filter(Boolean) as string[]
  );
  try {
    const allPlans = await listPlans();
    for (const p of allPlans) {
      if (p.stripePerUserPriceId) perUserPriceIds.add(p.stripePerUserPriceId);
    }
  } catch {
    // 取得失敗時は env のみで判定
  }

  const supportFeePriceId = process.env.STRIPE_PRICE_SUPPORT_FEE;

  let perUserItemId: string | null = null;
  for (const item of sub.items.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    if (perUserPriceIds.size > 0 && perUserPriceIds.has(priceId)) {
      perUserItemId = item.id;
      break;
    }
    // フォールバック: support fee 以外を per-user とみなす
    if (supportFeePriceId && priceId !== supportFeePriceId) {
      perUserItemId = item.id;
    }
  }

  if (!perUserItemId) {
    return NextResponse.json({ error: 'per-user item が見つかりません' }, { status: 400 });
  }

  // 新しい line items を生成し、既存 items を削除して置換
  const newLineItems = buildSubscriptionLineItems(plan, newSeats);
  const deleteItems = sub.items.data.map((item) => ({ id: item.id, deleted: true }));

  await stripe.subscriptions.update(tenantRow.stripeSubscriptionId, {
    items: [...deleteItems, ...newLineItems],
    proration_behavior: 'create_prorations',
    metadata: { seats: String(newSeats), planCode: effectivePlanCode },
  });

  return NextResponse.json({ ok: true, newSeats, planCode: effectivePlanCode });
});
