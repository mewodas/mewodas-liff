import * as Sentry from '@sentry/nextjs';
import { waitUntil } from '@vercel/functions';
import { neon } from '@neondatabase/serverless';

type AuditOutcome = 'success' | 'failure';

interface AuditEvent {
  action: string;
  outcome: AuditOutcome;
  actorType: 'admin' | 'master' | 'customer' | 'system';
  actorId?: string;
  tenantId?: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  null;

const sql = dbUrl ? neon(dbUrl) : null;

const currentEnv =
  process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development';

function insertAuditRow(e: AuditEvent): Promise<void> {
  if (!sql) return Promise.resolve();
  return sql.query(
    `INSERT INTO audit_log
       (action, outcome, actor_type, actor_id, tenant_id, target_type, target_id, ip, user_agent, metadata, env)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      e.action,
      e.outcome,
      e.actorType,
      e.actorId ?? null,
      e.tenantId ?? null,
      e.targetType ?? null,
      e.targetId ?? null,
      e.ip ?? null,
      e.userAgent ?? null,
      e.metadata ? JSON.stringify(e.metadata) : null,
      currentEnv,
    ]
  )
    .then(() => undefined)
    .catch((err: unknown) => {
      console.error('[auditLog] DB insert failed', err);
    });
}

/** logAuditEvent の await 版。既に waitUntil コンテキスト内にいる呼び出し用（waitUntil の入れ子を避ける）。 */
export async function logAuditEventAsync(e: AuditEvent): Promise<void> {
  try {
    console.log(JSON.stringify({ type: 'audit', ts: new Date().toISOString(), ...e }));
    if (sql) await insertAuditRow(e);
  } catch (err) {
    console.error('[auditLog] async logging failed', err);
  }
}

export function logAuditEvent(e: AuditEvent): void {
  try {
    console.log(
      JSON.stringify({
        type: 'audit',
        ts: new Date().toISOString(),
        ...e,
      })
    );

    Sentry.addBreadcrumb({
      category: 'audit',
      message: `${e.action} [${e.outcome}]`,
      level: e.outcome === 'failure' ? 'warning' : 'info',
      data: {
        actorType: e.actorType,
        actorId: e.actorId,
        tenantId: e.tenantId,
        targetType: e.targetType,
        targetId: e.targetId,
        ...e.metadata,
      },
    });

    if (e.action === 'auth.login' && e.outcome === 'failure') {
      Sentry.captureMessage(`audit: auth.login failure actorId=${e.actorId ?? 'unknown'}`, 'warning');
    }

    if (sql) {
      const p = insertAuditRow(e);
      try {
        waitUntil(p);
      } catch {
        // waitUntil がリクエストコンテキスト外（cron 等）では throw する場合がある。
        // floating promise のまま走らせる（.catch() は insertAuditRow 内に付与済み）。
      }
    }
  } catch (err) {
    console.error('[auditLog] logging failed', err);
  }
}
