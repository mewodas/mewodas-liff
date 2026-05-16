import type { ErrorEvent } from '@sentry/nextjs';

export const SENTRY_COMMON_CONFIG = {
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,
  sendDefaultPii: false,
};

export function redactEvent(event: ErrorEvent): ErrorEvent | null {
  try {
    let serialized = JSON.stringify(event);
    serialized = serialized.replace(/"(image|photo|picture)":\s*"data:[^"]+"/gi, '"[REDACTED]"');
    serialized = serialized.replace(/[A-Za-z0-9+/]{200,}={0,2}/g, '[BASE64_REDACTED]');
    return JSON.parse(serialized) as ErrorEvent;
  } catch {
    return event;
  }
}
