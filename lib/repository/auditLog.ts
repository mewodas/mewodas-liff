import { neon } from '@neondatabase/serverless';

export type AuditLogRow = {
  id: string;
  ts: string;
  action: string;
  outcome: string;
  actor_type: string;
  actor_id: string | null;
  tenant_id: string | null;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  env: string | null;
};

export type AuditLogFilter = {
  action?: string;
  outcome?: string;
  env?: string;
  from?: string;
  to?: string;
  limit?: number;
};

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  null;

export async function listAuditLogs(filter: AuditLogFilter = {}): Promise<AuditLogRow[]> {
  if (!dbUrl) return [];
  const sql = neon(dbUrl);

  const env = filter.env ?? 'production';
  const limit = Math.min(filter.limit ?? 100, 500);
  const from = filter.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const params: (string | number)[] = [env, from];
  const conditions: string[] = ['env = $1', 'ts >= $2'];

  if (filter.to) {
    params.push(filter.to);
    conditions.push(`ts <= $${params.length}`);
  }

  if (filter.action) {
    params.push(filter.action);
    conditions.push(`action = $${params.length}`);
  }

  if (filter.outcome) {
    params.push(filter.outcome);
    conditions.push(`outcome = $${params.length}`);
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;

  const where = `WHERE ${conditions.join(' AND ')}`;
  const rows = await sql.query(
    `SELECT id, ts, action, outcome, actor_type, actor_id, tenant_id, target_type, target_id, ip, user_agent, metadata, env
     FROM audit_log
     ${where}
     ORDER BY ts DESC
     LIMIT ${limitPlaceholder}`,
    params
  );

  return (rows as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    const rawTs = row.ts;
    const ts =
      rawTs instanceof Date
        ? rawTs.toISOString()
        : typeof rawTs === 'string'
        ? rawTs
        : String(rawTs);
    const rawMeta = row.metadata;
    let metadata: Record<string, unknown> | null = null;
    if (rawMeta && typeof rawMeta === 'string') {
      try { metadata = JSON.parse(rawMeta); } catch { metadata = null; }
    } else if (rawMeta && typeof rawMeta === 'object') {
      metadata = rawMeta as Record<string, unknown>;
    }
    return {
      id: String(row.id),
      ts,
      action: String(row.action),
      outcome: String(row.outcome),
      actor_type: String(row.actor_type),
      actor_id: row.actor_id != null ? String(row.actor_id) : null,
      tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
      target_type: row.target_type != null ? String(row.target_type) : null,
      target_id: row.target_id != null ? String(row.target_id) : null,
      ip: row.ip != null ? String(row.ip) : null,
      user_agent: row.user_agent != null ? String(row.user_agent) : null,
      metadata,
      env: row.env != null ? String(row.env) : null,
    } satisfies AuditLogRow;
  });
}

export function isDbConnected(): boolean {
  return dbUrl !== null;
}
