import { listAllCustomers, getFoodRecordsByDateRange } from '@/lib/notion';
import { listWeightLogsByLineUser } from '@/lib/repository/weightLogs';
import { computeRecordGap, computeWeightRecordGap, computeWeightStall } from '@/lib/risk';
import { upsertCustomerRisk } from '@/lib/repository/customerRisk';
import { getCurrentTenant } from '@/lib/tenant';

function jstToday(): string {
  const d = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function computeAndStoreTenantRisk(): Promise<void> {
  const tenant = getCurrentTenant();
  const today = jstToday();

  let customers: Awaited<ReturnType<typeof listAllCustomers>>;
  try {
    customers = await listAllCustomers();
  } catch (err) {
    console.error('[customerRiskService] listAllCustomers failed', err);
    return;
  }

  const active = customers.filter(
    (c) => c.foodStatus === '進行中' && c.lineUserId
  );

  const recordStart = subtractDays(today, 4);
  const weightStart = subtractDays(today, 20);

  const rows: Parameters<typeof upsertCustomerRisk>[0] = [];

  for (const customer of active) {
    try {
      const [foodRecords, weightLogs] = await Promise.all([
        getFoodRecordsByDateRange(customer.lineUserId, recordStart, today).catch(() => []),
        listWeightLogsByLineUser(customer.lineUserId, weightStart, today).catch(() => []),
      ]);

      const latestRecord =
        foodRecords.length > 0
          ? foodRecords.reduce((a, b) => (a.date >= b.date ? a : b)).date
          : null;

      const { noRecord, daysSinceLastRecord } = computeRecordGap(latestRecord, today);

      const latestWeightDate =
        weightLogs.length > 0
          ? weightLogs.reduce((a, b) => (a.date >= b.date ? a : b)).date
          : null;
      const { daysSinceLastWeight } = computeWeightRecordGap(latestWeightDate, today);

      const goalDirection: 'down' | 'up' =
        customer.currentWeight !== null &&
        customer.targetWeight !== null &&
        customer.targetWeight < customer.currentWeight
          ? 'down'
          : customer.plan?.includes('増量')
          ? 'up'
          : 'down';

      const { stalled, weeklyAvgs } = computeWeightStall(
        weightLogs.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        goalDirection,
        today
      );

      rows.push({
        tenantId: tenant.id,
        customerPageId: customer.pageId,
        lineUserId: customer.lineUserId || null,
        name: customer.name || null,
        storeId: customer.storeId || null,
        noRecord,
        daysSinceLastRecord,
        daysSinceLastWeight,
        weightStalled: stalled,
        weeklyAvgs,
      });
    } catch (err) {
      console.error(`[customerRiskService] customer ${customer.pageId} failed`, err);
    }
  }

  await upsertCustomerRisk(rows);
}
