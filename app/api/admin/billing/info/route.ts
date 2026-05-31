// 現テナントの課金情報 + 席数ステータスを返す API

import { NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getSeatStatus } from '@/lib/seats';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminTenant(async () => {
  const tenant = getCurrentTenant();
  // テナント行は 1 回だけ取得し、getSeatStatus にも同じ Promise を渡して
  // Notion への listTenantRows クエリ重複（旧: 1 リクエストで 2 本）を解消。
  // Promise を共有するため並列性は維持される。
  const rowsPromise = listTenantRows(FITMEAL_TENANTS_DB_ID);
  const [rows, seatStatus] = await Promise.all([
    rowsPromise,
    getSeatStatus({ tenantRows: rowsPromise }),
  ]);
  const t = rows.find((r) => r.tenantId === tenant.id);
  if (!t) {
    return NextResponse.json({ error: 'テナント未登録' }, { status: 404 });
  }

  // Stripe Subscription を直接照会して解約予約を取得。
  // Stripe は予約解約を 2 通りで表現する:
  //   (a) cancel_at_period_end=true（期間末で解約）
  //   (b) cancel_at に Unix 秒（特定日で解約。Portal でのトライアル中キャンセルはこちら）
  // どちらか入っていれば「解約予約中」とみなす。Webhook では状態変化を取れないため API 経由が確実。
  let cancelAtPeriodEnd = false;
  let cancelAt: string | null = null;
  if (t.stripeSubscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(t.stripeSubscriptionId);
      cancelAtPeriodEnd = !!sub.cancel_at_period_end || !!sub.cancel_at;
      const ts =
        sub.cancel_at ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sub as any).current_period_end ??
        sub.items.data[0]?.current_period_end ??
        null;
      cancelAt = ts ? new Date(ts * 1000).toISOString().split('T')[0] : null;
    } catch (e) {
      console.error('Stripe subscription retrieve 失敗:', e);
    }
  }

  return NextResponse.json({
    tenantName: t.name,
    ownerEmail: t.ownerEmail,
    plan: t.plan,
    customerCount: t.customerCount,
    monthlyPrice: t.monthlyPrice,
    billingCycle: t.billingCycle,
    nextBillingDate: t.nextBillingDate,
    paymentStatus: t.paymentStatus,
    hasStripeCustomer: !!t.stripeCustomerId,
    cancelAtPeriodEnd,
    cancelAt,
    // 席数ステータス
    seatLimit: seatStatus.seatLimit,
    currentSeats: seatStatus.currentSeats,
    totalCustomers: seatStatus.totalCustomers,
    remaining: seatStatus.remaining,
    isOverLimit: seatStatus.isOverLimit,
    isNearLimit: seatStatus.isNearLimit,
    planTier: seatStatus.planTier,
    hasContract: seatStatus.hasContract,
    billingMode: t.billingMode,
    seatSource: seatStatus.seatSource,
  });
});
