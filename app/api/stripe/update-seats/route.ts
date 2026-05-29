// 席数・プラン変更確定 API
//
// POST /api/stripe/update-seats
// body: { seats: number, planCode?: string }
// Stripe Subscription の per-user item quantity / price を更新する

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import {
  getStripe,
  buildSubscriptionLineItems,
} from '@/lib/stripe';
import { listTenantRows, getPlanByCode } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getSeatStatus } from '@/lib/seats';
import { logAuditEvent } from '@/lib/auditLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const newSeats = Number(body.seats);
  const planCodeInput = body.planCode as string | undefined;

  const session = currentSession(req);
  const tenant = getCurrentTenant();
  const stripe = getStripe();

  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRow = rows.find((r) => r.tenantId === tenant.id);
  if (!tenantRow?.stripeSubscriptionId) {
    return NextResponse.json({ error: '契約なし' }, { status: 400 });
  }

  // 課金モードガード: Stripe連動 以外（無制限・手動）は席数を Stripe 経由で変更できない。
  // billingMode 未設定（null）は後方互換で Stripe連動 扱い。
  if (tenantRow.billingMode && tenantRow.billingMode !== 'Stripe連動') {
    return NextResponse.json(
      { error: 'このテナントは運営管理プランのため、課金画面からの席数変更はできません' },
      { status: 403 }
    );
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

  if (sub.items.data.length === 0) {
    return NextResponse.json({ error: 'サブスクリプション items が空です' }, { status: 400 });
  }

  // 全 items を削除して新しい line items（buildSubscriptionLineItems）で置換する
  const newLineItems = buildSubscriptionLineItems(plan, newSeats);
  const deleteItems = sub.items.data.map((item) => ({ id: item.id, deleted: true }));

  await stripe.subscriptions.update(tenantRow.stripeSubscriptionId, {
    items: [...deleteItems, ...newLineItems],
    proration_behavior: 'create_prorations',
    metadata: { seats: String(newSeats), planCode: effectivePlanCode },
  });

  logAuditEvent({ action: 'billing.update_seats', outcome: 'success', actorType: session?.role === 'master' ? 'master' : 'admin', actorId: session?.email, tenantId: tenant.id, targetType: 'subscription', targetId: tenantRow.stripeSubscriptionId, metadata: { newSeats, planCode: effectivePlanCode } });
  return NextResponse.json({ ok: true, newSeats, planCode: effectivePlanCode });
});
