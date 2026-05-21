// Stripe反映 API（マスタ専用）
// 未契約テナント → Checkout Session URL を発行して返す
// 契約済みテナント → subscription.update で価格・数量を入替

import { NextRequest, NextResponse } from 'next/server';
import { withMasterOnly } from '@/lib/withTenant';
import { listTenantRows, updateTenantRow, getPlanByCode } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getStripe, buildSubscriptionLineItems } from '@/lib/stripe';
import { invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withMasterOnly(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const seats = Number(body.seats);
    const planCode = String(body.planCode || 'standard');

    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const tenantRow = all.find((t) => t.pageId === id || t.tenantId === id);
    if (!tenantRow) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const plan = await getPlanByCode(planCode);
    if (!plan) return NextResponse.json({ error: `プラン '${planCode}' が見つかりません` }, { status: 404 });

    const minSeats = plan.minSeats;
    if (!seats || seats < minSeats) {
      return NextResponse.json({ error: `席数は${minSeats}名以上必須` }, { status: 400 });
    }

    const stripe = getStripe();

    let stripeCustomerId = tenantRow.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenantRow.ownerEmail || undefined,
        name: tenantRow.name,
        metadata: { tenantId: tenantRow.tenantId },
      });
      stripeCustomerId = customer.id;
      await updateTenantRow(tenantRow.pageId, { stripeCustomerId });
      invalidateTenantCache();
    }

    const lineItems = buildSubscriptionLineItems(plan, seats);
    const origin = req.nextUrl.origin;

    // 契約済みかどうかで分岐
    if (tenantRow.stripeSubscriptionId) {
      // 契約済み → subscription.update で価格・数量入替
      const sub = await stripe.subscriptions.retrieve(tenantRow.stripeSubscriptionId, {
        expand: ['items.data.price'],
      });

      // 既存 items を削除し、新しい items で上書き
      const deleteItems = sub.items.data.map((item) => ({ id: item.id, deleted: true }));
      const addItems = lineItems;

      await stripe.subscriptions.update(tenantRow.stripeSubscriptionId, {
        items: [...deleteItems, ...addItems],
        proration_behavior: 'create_prorations',
        metadata: { seats: String(seats), planCode },
      });

      await updateTenantRow(tenantRow.pageId, {
        seatLimit: seats,
        planCode,
      });
      invalidateTenantCache();

      return NextResponse.json({ ok: true, action: 'updated' });
    } else {
      // 未契約 → Checkout Session を生成して URL を返す
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        locale: 'ja',
        line_items: lineItems,
        success_url: `${origin}/admin/tenants/${tenantRow.pageId}?stripeSuccess=1`,
        cancel_url: `${origin}/admin/tenants/${tenantRow.pageId}?stripeCanceled=1`,
        metadata: { tenantId: tenantRow.tenantId, seats: String(seats), planCode },
        subscription_data: {
          trial_period_days: 14,
          metadata: { tenantId: tenantRow.tenantId, seats: String(seats), planCode },
        },
      });

      return NextResponse.json({ ok: true, action: 'checkout', url: session.url, sessionId: session.id });
    }
  } catch (e) {
    console.error('apply-stripe error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
