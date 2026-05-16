import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  if (!process.env.SENTRY_DSN) return;

  const { default: Sentry } = await import('@sentry/nextjs');

  try {
    const { getCurrentTenant } = await import('./lib/tenant');
    const tenant = getCurrentTenant();
    Sentry.withScope((scope) => {
      scope.setTag('tenant_id', tenant.id);
      scope.setTag('tenant_name', tenant.name);
      scope.setTag('route', request.path);
      scope.setTag('route_type', context.routeType);
      scope.setExtra('method', request.method);
      Sentry.captureException(err);
    });
  } catch {
    Sentry.captureException(err);
  }
};
