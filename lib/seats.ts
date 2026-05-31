import { listCustomers } from './repository/customers';
import { listTenantRows, type TenantRow } from './notion';
import { getCurrentTenant } from './tenant';
import { FITMEAL_TENANTS_DB_ID } from './tenant';
import { getCached, setCached, invalidate } from './cache';
import type { PlanTier } from './stripe';

export type SeatStatus = {
  seatLimit: number | null;
  /** アクティブ席数（休止中・卒業は除外） */
  currentSeats: number;
  /** 総顧客数（参考。全ステータス含む） */
  totalCustomers: number;
  remaining: number | null;
  isOverLimit: boolean;
  isNearLimit: boolean;
  planTier: PlanTier | null;
  hasContract: boolean;
  seatSource: 'unlimited' | 'manual' | 'stripe';
};

/** 席数カウント対象のステータス（進行中のみ）
 *  休止中・卒業 は seat を消費しない
 */
const ACTIVE_FOOD_STATUS = '進行中';

export async function getSeatStatus(opts?: {
  noCache?: boolean;
  /** 既に取得済みのテナント行（配列 or Promise）を渡すと、Notion への
   *  listTenantRows クエリを重複させず使い回す。同一リクエスト内で
   *  別途 listTenantRows を呼ぶ呼び出し元（billing/info 等）向け。 */
  tenantRows?: TenantRow[] | Promise<TenantRow[]>;
}): Promise<SeatStatus> {
  const tenantId = getCurrentTenant().id;
  const key = `${tenantId}:seats:status`;
  if (!opts?.noCache) {
    const hit = getCached<SeatStatus>(key);
    if (hit) return hit;
  }

  const [customers, rows] = await Promise.all([
    listCustomers({ noCache: opts?.noCache }),
    opts?.tenantRows ?? listTenantRows(FITMEAL_TENANTS_DB_ID),
  ]);

  const tenantRow = rows.find((r) => r.tenantId === tenantId);
  const billingMode = tenantRow?.billingMode ?? null;
  const planTier = tenantRow?.planTier ?? null;
  const hasContract = !!(
    tenantRow?.stripeSubscriptionId &&
    (tenantRow?.paymentStatus === '有効' || tenantRow?.paymentStatus === 'お試し')
  );
  // 「進行中」顧客のみ seat カウント対象（休止中・卒業・サンプルは除外）
  const isSample = (c: { lineUserId?: string | null }) =>
    !!c.lineUserId && (c.lineUserId.startsWith('SAMPLE_') || c.lineUserId.startsWith('DEMO_'));
  const activeCustomers = customers.filter(
    (c) => c.foodStatus === ACTIVE_FOOD_STATUS && !isSample(c)
  );
  const currentSeats = activeCustomers.length;
  // サンプル顧客は総数にも含めない
  const totalCustomers = customers.filter((c) => !isSample(c)).length;

  let seatLimit: number | null;
  let seatSource: SeatStatus['seatSource'];
  let isOverLimit: boolean;

  if (billingMode === '無制限') {
    seatLimit = null;
    seatSource = 'unlimited';
    isOverLimit = false;
  } else if (billingMode === '手動') {
    seatLimit = tenantRow?.seatLimit ?? null;
    seatSource = 'manual';
    isOverLimit = seatLimit !== null ? currentSeats >= seatLimit : false;
  } else {
    // 'Stripe連動' または billingMode 未設定（後方互換）
    seatLimit = tenantRow?.seatLimit ?? null;
    seatSource = 'stripe';
    isOverLimit = seatLimit !== null ? currentSeats >= seatLimit : false;
  }

  const remaining = seatLimit !== null ? seatLimit - currentSeats : null;
  const isNearLimit = remaining !== null ? remaining <= 1 && !isOverLimit : false;

  const status: SeatStatus = {
    seatLimit,
    currentSeats,
    totalCustomers,
    remaining,
    isOverLimit,
    isNearLimit,
    planTier,
    hasContract,
    seatSource,
  };

  setCached(key, status, 60_000);
  return status;
}

export function invalidateSeatCache(): void {
  const tenantId = getCurrentTenant().id;
  invalidate(`${tenantId}:seats:`);
}
