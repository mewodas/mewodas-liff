import * as Sentry from '@sentry/nextjs';

type AuditOutcome = 'success' | 'failure';

interface AuditEvent {
  action: string;
  outcome: AuditOutcome;
  actorType: 'admin' | 'master' | 'customer' | 'system';
  actorId?: string;
  tenantId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
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
  } catch (err) {
    console.error('[auditLog] logging failed', err);
  }
}
