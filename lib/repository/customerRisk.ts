import { neon } from '@neondatabase/serverless';

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  null;

const currentEnv =
  process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development';

export type CustomerRiskRow = {
  tenantId: string;
  customerPageId: string;
  lineUserId: string | null;
  name: string | null;
  storeId: string | null;
  noRecord: boolean;
  daysSinceLastRecord: number | null;
  daysSinceLastWeight: number | null;
  weightStalled: boolean;
  weeklyAvgs: number[];
  env: string | null;
  computedAt: string;
};

type UpsertInput = {
  tenantId: string;
  customerPageId: string;
  lineUserId: string | null;
  name: string | null;
  storeId: string | null;
  noRecord: boolean;
  daysSinceLastRecord: number | null;
  daysSinceLastWeight: number | null;
  weightStalled: boolean;
  weeklyAvgs: number[];
};

export async function upsertCustomerRisk(rows: UpsertInput[]): Promise<void> {
  if (!dbUrl || rows.length === 0) return;
  const sql = neon(dbUrl);
  try {
    for (const r of rows) {
      await sql.query(
        `INSERT INTO customer_risk
           (tenant_id, customer_page_id, line_user_id, name, store_id,
            no_record, days_since_last_record, days_since_last_weight, weight_stalled, weekly_avgs, env, computed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         ON CONFLICT (tenant_id, customer_page_id) DO UPDATE SET
           line_user_id = EXCLUDED.line_user_id,
           name = EXCLUDED.name,
           store_id = EXCLUDED.store_id,
           no_record = EXCLUDED.no_record,
           days_since_last_record = EXCLUDED.days_since_last_record,
           days_since_last_weight = EXCLUDED.days_since_last_weight,
           weight_stalled = EXCLUDED.weight_stalled,
           weekly_avgs = EXCLUDED.weekly_avgs,
           env = EXCLUDED.env,
           computed_at = now()`,
        [
          r.tenantId,
          r.customerPageId,
          r.lineUserId ?? null,
          r.name ?? null,
          r.storeId ?? null,
          r.noRecord,
          r.daysSinceLastRecord ?? null,
          r.daysSinceLastWeight ?? null,
          r.weightStalled,
          JSON.stringify(r.weeklyAvgs),
          currentEnv,
        ]
      );
    }
  } catch (err) {
    console.error('[customerRisk] upsert failed', err);
  }
}

export async function listCustomerRiskByTenant(
  tenantId: string,
  env: string
): Promise<CustomerRiskRow[]> {
  if (!dbUrl) return [];
  const sql = neon(dbUrl);
  try {
    const rows = await sql.query(
      `SELECT tenant_id, customer_page_id, line_user_id, name, store_id,
              no_record, days_since_last_record, days_since_last_weight, weight_stalled, weekly_avgs, env, computed_at
       FROM customer_risk
       WHERE tenant_id = $1 AND env = $2`,
      [tenantId, env]
    );
    return (rows as unknown[]).map((r) => {
      const row = r as Record<string, unknown>;
      let weeklyAvgs: number[] = [];
      if (Array.isArray(row.weekly_avgs)) {
        weeklyAvgs = row.weekly_avgs as number[];
      } else if (typeof row.weekly_avgs === 'string') {
        try {
          weeklyAvgs = JSON.parse(row.weekly_avgs);
        } catch {
          weeklyAvgs = [];
        }
      }
      const rawTs = row.computed_at;
      const computedAt =
        rawTs instanceof Date
          ? rawTs.toISOString()
          : typeof rawTs === 'string'
          ? rawTs
          : String(rawTs);
      return {
        tenantId: String(row.tenant_id),
        customerPageId: String(row.customer_page_id),
        lineUserId: row.line_user_id != null ? String(row.line_user_id) : null,
        name: row.name != null ? String(row.name) : null,
        storeId: row.store_id != null ? String(row.store_id) : null,
        noRecord: Boolean(row.no_record),
        daysSinceLastRecord:
          row.days_since_last_record != null
            ? Number(row.days_since_last_record)
            : null,
        daysSinceLastWeight:
          row.days_since_last_weight != null
            ? Number(row.days_since_last_weight)
            : null,
        weightStalled: Boolean(row.weight_stalled),
        weeklyAvgs,
        env: row.env != null ? String(row.env) : null,
        computedAt,
      } satisfies CustomerRiskRow;
    });
  } catch (err) {
    console.error('[customerRisk] list failed', err);
    return [];
  }
}

export async function latestComputedAt(
  tenantId: string,
  env: string
): Promise<string | null> {
  if (!dbUrl) return null;
  const sql = neon(dbUrl);
  try {
    const rows = await sql.query(
      `SELECT MAX(computed_at) AS ts FROM customer_risk WHERE tenant_id = $1 AND env = $2`,
      [tenantId, env]
    );
    const row = (rows as unknown[])[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const ts = row.ts;
    if (!ts) return null;
    return ts instanceof Date ? ts.toISOString() : String(ts);
  } catch (err) {
    console.error('[customerRisk] latestComputedAt failed', err);
    return null;
  }
}
