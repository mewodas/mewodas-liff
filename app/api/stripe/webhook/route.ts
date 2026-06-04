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
} from '@/lib/stripe';
import { listPlans } from '@/lib/notion';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { provisionTenant } from '@/lib/provisionTenant';
import { sendEmail, paymentFailedEmail } from '@/lib/email';
import { notifySlack } from '@/lib/slack';

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

async function getPerUserPriceIdsFromPlans(): Promise<Set<string>> {
  const ids = getPerUserPriceIds();
  try {
    const plans = await listPlans();
    for (const plan of plans) {
      if (plan.stripePerUserPriceId) ids.add(plan.stripePerUserPriceId);
    }
  } catch {
    // プラン DB 取得失敗時は env のみで判定
  }
  return ids;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  // セルフサーブ申込: LP からの新規申込で tenantId が未存在の状態。
  // provisionTenant() でテナント自動発行 + Stripe IDs 紐付け + ウェルカムメール送信。
  // 冪等: 同じ stripeCustomerId のテナントが既にあれば再利用 (webhook リトライ耐性)。
  if (session.metadata?.selfServe === 'true') {
    await handleSelfServeCheckoutCompleted(session);
    return;
  }

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

async function handleSelfServeCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!customerId) {
    console.error('selfServe checkout に customer がない:', session.id);
    return;
  }

  const gymName = session.metadata?.gymName;
  if (!gymName) {
    // gymName 必須・LP では required input なので通常欠落しない。
    // 黙ってデフォルト名で発行するとテナント識別不能になるためアラート優先で abort。
    console.error('selfServe: gymName が metadata に無い session.id=', session.id, 'metadata=', session.metadata);
    return;
  }
  const ownerName = session.metadata?.ownerName || '';
  const ownerEmail = session.customer_details?.email || session.customer_email || '';
  if (!ownerEmail) {
    console.error('selfServe checkout に customer email がない:', session.id);
    return;
  }

  // トライアル終了日を Stripe から取得 (subscription を引いて trial_end を見る)
  let trialEndDate: string | null = null;
  if (subscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (sub.trial_end) {
        trialEndDate = new Date(sub.trial_end * 1000).toISOString().split('T')[0];
      }
    } catch (e) {
      console.error('selfServe trial_end 取得失敗:', e);
    }
  }

  const note = ownerName ? `セルフサーブ申込 (担当: ${ownerName})` : 'セルフサーブ申込';
  const planLabel = session.metadata?.planCode === 'standard' ? '標準プラン' : (session.metadata?.planCode || '標準プラン');

  // プロビジョニング (冪等)
  const result = await provisionTenant({
    name: gymName,
    ownerEmail,
    plan: planLabel,
    note,
    billingMode: 'Stripe連動',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId || null,
    trialEndDate,
    selfServe: true,
  });

  if (result.reused) {
    console.log(`selfServe: 既存テナント再利用 (冪等) tenantId=${result.tenantId}`);
    return;
  }

  console.log(`selfServe: テナント発行 tenantId=${result.tenantId} mail=${result.mail.sent}`);

  // Stripe 側 subscription metadata に tenantId を後追いで書き込み (将来の event tracing 用)
  if (subscriptionId) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          ...(session.metadata || {}),
          tenantId: result.tenantId,
        },
      });
      // seatLimit / planTier / monthlyPrice を確定させる
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await handleSubscriptionUpdate(sub);
    } catch (e) {
      console.error('selfServe subscription metadata 更新失敗:', e);
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

  // 課金モードガード: Stripe連動 以外は seatLimit/paymentStatus を書き換えない
  if (tenant.billingMode && tenant.billingMode !== 'Stripe連動') return;

  const status = subscriptionStatusToNotion(sub.status);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (sub as any).current_period_end || sub.items.data[0]?.current_period_end;
  const nextBillingDate = periodEnd
    ? new Date(periodEnd * 1000).toISOString().split('T')[0]
    : null;

  // per-user item を Price ID で識別（全プラン定義 + env）
  const perUserPriceIds = await getPerUserPriceIdsFromPlans();
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
  // 月額は Stripe 実額から算出（プランに依存しない）。
  // getMonthlyTotal は標準プラン定数を使うため非標準プランで誤った金額になる。
  const monthlyPrice = supportFeeAmount + perUserUnitAmount * perUserQuantity;

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

  // 課金モードガード: Stripe連動 以外は seatLimit/status を書き換えない
  if (tenant.billingMode && tenant.billingMode !== 'Stripe連動') return;

  await updateTenantRow(tenant.pageId, {
    paymentStatus: '解約済み',
    status: '解約',
    seatLimit: null,
    planTier: null,
    nextBillingDate: null,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;

  // 課金モードガード: Stripe連動 以外は paymentStatus を書き換えない
  if (tenant.billingMode && tenant.billingMode !== 'Stripe連動') return;

  await updateTenantRow(tenant.pageId, {
    paymentStatus: '未払い',
  });

  // オーナーへカード更新を促すメール + 運営へ Slack 通知（任意）。
  // 通知失敗は webhook を壊さない（Stripe へは必ず 200 を返す）。
  try {
    if (tenant.ownerEmail) {
      await sendEmail(paymentFailedEmail({ tenantName: tenant.name, ownerEmail: tenant.ownerEmail }));
    }
    await notifySlack(
      `⚠️ FitMeal 支払い失敗: ${tenant.name}（${tenant.tenantId}）の請求が失敗しました。paymentStatus=未払い に更新。`
    );
  } catch (e) {
    console.error('[webhook] payment_failed notification error', e);
  }
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
