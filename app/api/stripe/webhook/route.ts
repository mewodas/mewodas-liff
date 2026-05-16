// Stripe Webhook ハンドラ
//
// Stripe から送られるイベントを受信して Notion テナント DB に同期。
// 主なイベント:
//   - customer.subscription.created/updated/deleted
//   - invoice.payment_succeeded
//   - invoice.payment_failed
//   - checkout.session.completed
//
// セキュリティ:
//   - STRIPE_WEBHOOK_SECRET で署名検証

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, subscriptionStatusToNotion } from '@/lib/stripe';
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
        // 未処理イベントは ack だけ返す
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
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;

  const status = subscriptionStatusToNotion(sub.status);
  // 最新の Stripe SDK では current_period_end は items.data[0].current_period_end に移動
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (sub as any).current_period_end || sub.items.data[0]?.current_period_end;
  const nextBillingDate = periodEnd
    ? new Date(periodEnd * 1000).toISOString().split('T')[0]
    : null;

  // 数量と料金は最初の item から取得
  const item = sub.items.data[0];
  const quantity = item?.quantity ?? 0;
  const unitAmount = item?.price?.unit_amount ?? 0;
  const interval = item?.price?.recurring?.interval;
  const monthlyPrice = interval === 'year' ? Math.round((unitAmount * quantity) / 12) : unitAmount * quantity;

  await updateTenantRow(tenant.pageId, {
    stripeSubscriptionId: sub.id,
    paymentStatus: status,
    nextBillingDate,
    customerCount: quantity,
    monthlyPrice,
    billingCycle: interval === 'year' ? '年払い' : '月払い',
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;

  await updateTenantRow(tenant.pageId, {
    paymentStatus: '解約済み',
    status: '解約',
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

async function updateTenantByStripeIds(
  tenantId: string,
  patch: { stripeCustomerId: string | null; stripeSubscriptionId: string | null }
) {
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenant = rows.find((r) => r.tenantId === tenantId);
  if (!tenant) return;
  await updateTenantRow(tenant.pageId, patch);
}
