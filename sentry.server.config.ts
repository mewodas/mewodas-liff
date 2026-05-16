import * as Sentry from '@sentry/nextjs';
import { SENTRY_COMMON_CONFIG, redactEvent } from './lib/sentry';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    ...SENTRY_COMMON_CONFIG,
    beforeSend: redactEvent,
  });
}
