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
  MIN_SEATS,
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
  // ★ 課金整合性: 非公開/無効プラン（内部・PoC・旧プラン等）を自己申込みで選択させない。
  //   getPlanByCode は公開/有効フラグを無視して返すため、ここで弾かないと安価な内部プランで価格バイパス可能。
  if (!plan.published || !plan.active) {
    return NextResponse.json({ error: 'このプランは選択できません' }, { status: 403 });
  }

  // 最低席数は「プラン定義」と「全社共通下限 MIN_SEATS」の大きい方を強制（minSeats=1 等での下限バイパス防止）
  const minSeats = Math.max(plan.minSeats, MIN_SEATS);
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

  // 課金モードガード: Stripe連動 以外（無制限・手動）は運営管理プランのため自己申込み不可。
  // billingMode 未設定（null）は後方互換で Stripe連動 扱い。
  if (tenantRow.billingMode && tenantRow.billingMode !== 'Stripe連動') {
    return NextResponse.json(
      { error: 'このテナントは運営管理プランのため、課金画面からの申込みはできません' },
      { status: 403 }
    );
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
