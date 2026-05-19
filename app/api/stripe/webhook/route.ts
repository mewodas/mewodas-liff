// Stripe Webhook ハンドラ
//
// 主なイベント:
//   - customer.subscription.created/updated/deleted
//   - invoice.payment_succeeded
//   - invoice.payment_failed
//   - checkout.session.completed
//
// per-user item の識別:
//   STRIPE_PRICE_STARTER_PER_USER / GROWTH / SCALE 環境変数に一致する Price ID を持つ item を席数源泉とする。
//   Price ID が環境変数未設定 or 一致しない Subscription はスキップ（旧契約 or dev/preview inline）。

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  getStripe,
  subscriptionStatusToNotion,
  getPlanTierBySeats,
  getMonthlyTotal,
} from '@/lib/stripe';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature') || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET 未設定' }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'signature error';
    return NextResponse.json({ error: `署名検証失敗: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook 処理エラー:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}

function getPerUserPriceIds(): Set<string> {
  const ids = new Set<string>();
  if (process.env.STRIPE_PRICE_PER_USER) ids.add(process.env.STRIPE_PRICE_PER_USER);
  // 後方互換: 旧 tier ベース env も拾う（移行期）
  const legacy = [
    process.env.STRIPE_PRICE_STARTER_PER_USER,
    process.env.STRIPE_PRICE_GROWTH_PER_USER,
    process.env.STRIPE_PRICE_SCALE_PER_USER,
  ];
  for (const id of legacy) {
    if (id) ids.add(id);
  }
  return ids;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  const tenantId = session.metadata?.tenantId;
  if (!tenantId) return;

  await updateTenantByStripeIds(tenantId, {
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscriptionId || null,
  });

  // subscription.created が先に走って tenant 解決に失敗していた場合のリカバリ:
  // ここで明示的に retrieve → 同じ更新処理を流す
  if (subscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await handleSubscriptionUpdate(sub);
    } catch (e) {
      console.error('checkout.session.completed → subscription retrieve 失敗:', e);
    }
  }
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  // 1次: customer ID で検索（通常ルート）
  // 2次: sub.metadata.tenantId で検索（checkout.session.completed 前に subscription.created が
  //       届いた場合、Notion 側にまだ customer ID が無いため customer ID では一致しない）
  let tenant = await findTenantByCustomerId(customerId);
  if (!tenant) {
    const metaTenantId = sub.metadata?.tenantId;
    if (metaTenantId) {
      tenant = await findTenantByTenantId(metaTenantId);
    }
  }
  if (!tenant) return;

  const status = subscriptionStatusToNotion(sub.status);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (sub as any).current_period_end || sub.items.data[0]?.current_period_end;
  const nextBillingDate = periodEnd
    ? new Date(periodEnd * 1000).toISOString().split('T')[0]
    : null;

  // per-user item を Price ID で識別
  const perUserPriceIds = getPerUserPriceIds();
  let seatLimit: number | null = null;
  let perUserUnitAmount = 0;
  let perUserQuantity = 0;
  let supportFeeAmount = 0;

  if (perUserPriceIds.size > 0) {
    // 新プラン構造 Subscription
    for (const item of sub.items.data) {
      const priceId = item.price?.id;
      if (priceId && perUserPriceIds.has(priceId)) {
        perUserQuantity = item.quantity ?? 0;
        perUserUnitAmount = item.price?.unit_amount ?? 0;
        seatLimit = perUserQuantity;
      } else {
        // サポート費 item
        supportFeeAmount = (item.price?.unit_amount ?? 0) * (item.quantity ?? 1);
      }
    }
  } else {
    // Price ID 未設定（dev/preview inline price_data）: 旧構造と同様にスキップせず処理
    // inline price の場合 price.id は 'price_...' ではなく一時 ID なので識別不可
    // metadata の seats を使用
    const metaSeats = Number((sub as Stripe.Subscription).metadata?.seats);
    if (metaSeats > 0) {
      seatLimit = metaSeats;
      const item = sub.items.data[0];
      perUserQuantity = item?.quantity ?? 0;
      perUserUnitAmount = item?.price?.unit_amount ?? 0;
    }
  }

  const planTier = seatLimit !== null && seatLimit > 0 ? getPlanTierBySeats(seatLimit) : null;
  const { total: expectedTotal } = seatLimit !== null ? getMonthlyTotal(seatLimit) : { total: 0 };
  // 月額は計算値を使う（サポート費 + per-user 合計）
  const monthlyPrice = seatLimit !== null ? expectedTotal : (supportFeeAmount + perUserUnitAmount * perUserQuantity);

  const patch: Parameters<typeof updateTenantRow>[1] = {
    stripeSubscriptionId: sub.id,
    paymentStatus: status,
    nextBillingDate,
    monthlyPrice: monthlyPrice || undefined,
    billingCycle: '月払い',
  };
  if (seatLimit !== null) {
    patch.seatLimit = seatLimit;
    patch.planTier = planTier;
  }

  await updateTenantRow(tenant.pageId, patch);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;

  await updateTenantRow(tenant.pageId, {
    paymentStatus: '解約済み',
    status: '解約',
    seatLimit: null,
    planTier: null,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;

  await updateTenantRow(tenant.pageId, {
    paymentStatus: '未払い',
  });
}

async function findTenantByCustomerId(customerId: string) {
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  return rows.find((r) => r.stripeCustomerId === customerId) || null;
}

async function findTenantByTenantId(tenantId: string) {
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  return rows.find((r) => r.tenantId === tenantId) || null;
}

async function updateTenantByStripeIds(
  tenantId: string,
  patch: { stripeCustomerId: string | null; stripeSubscriptionId: string | null }
) {
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenant = rows.find((r) => r.tenantId === tenantId);
  if (!tenant) return;
  await updateTenantRow(tenant.pageId, patch);
}
