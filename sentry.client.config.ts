import * as Sentry from '@sentry/nextjs';
import { SENTRY_COMMON_CONFIG, redactEvent } from './lib/sentry';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    ...SENTRY_COMMON_CONFIG,
    integrations: [
      Sentry.replayIntegration(),
    ],
    beforeSend: redactEvent,
  });
}
