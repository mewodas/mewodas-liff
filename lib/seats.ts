import { listCustomers } from './repository/customers';
import { listTenantRows } from './notion';
import { getCurrentTenant } from './tenant';
import { FITMEAL_TENANTS_DB_ID } from './tenant';
import { getCached, setCached, invalidate } from './cache';
import type { PlanTier } from './stripe';

export type SeatStatus = {
  seatLimit: number | null;
  currentSeats: number;
  remaining: number | null;
  isOverLimit: boolean;
  isNearLimit: boolean;
  planTier: PlanTier | null;
  hasContract: boolean;
};

export async function getSeatStatus(opts?: { noCache?: boolean }): Promise<SeatStatus> {
  const tenantId = getCurrentTenant().id;
  const key = `${tenantId}:seats:status`;
  if (!opts?.noCache) {
    const hit = getCached<SeatStatus>(key);
    if (hit) return hit;
  }

  const [customers, rows] = await Promise.all([
    listCustomers({ noCache: opts?.noCache }),
    listTenantRows(FITMEAL_TENANTS_DB_ID),
  ]);

  const tenantRow = rows.find((r) => r.tenantId === tenantId);
  const seatLimit = tenantRow?.seatLimit ?? null;
  const planTier = tenantRow?.planTier ?? null;
  const hasContract = !!(
    tenantRow?.stripeSubscriptionId &&
    (tenantRow?.paymentStatus === '有効' || tenantRow?.paymentStatus === 'お試し')
  );
  const currentSeats = customers.length;
  const remaining = seatLimit !== null ? seatLimit - currentSeats : null;
  const isOverLimit = seatLimit !== null ? currentSeats >= seatLimit : false;
  const isNearLimit = remaining !== null ? remaining <= 1 && !isOverLimit : false;

  const status: SeatStatus = {
    seatLimit,
    currentSeats,
    remaining,
    isOverLimit,
    isNearLimit,
    planTier,
    hasContract,
  };

  setCached(key, status, 60_000);
  return status;
}

export function invalidateSeatCache(): void {
  const tenantId = getCurrentTenant().id;
  invalidate(`${tenantId}:seats:`);
}
