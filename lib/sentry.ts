import type { ErrorEvent } from '@sentry/nextjs';

export const SENTRY_COMMON_CONFIG = {
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  sendDefaultPii: false,
};

export function redactEvent(event: ErrorEvent): ErrorEvent | null {
  try {
    let s = JSON.stringify(event);
    // 画像 data URI（食事/体組成写真など PII）→ キーは保持して値だけ伏せる
    // （旧実装はキーごと消して JSON を壊し、catch で unredacted にフォールバックしていた）
    s = s.replace(/"(image|photo|picture)":\s*"data:[^"]*"/gi, '"$1":"[REDACTED]"');
    // それ以外の長い base64（添付や生データ）
    s = s.replace(/[A-Za-z0-9+/]{200,}={0,2}/g, '[BASE64_REDACTED]');
    // 認証情報: Bearer トークン / Authorization・Cookie ヘッダ / セッション Cookie
    s = s.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
    s = s.replace(/"(authorization|cookie|set-cookie)":\s*"[^"]*"/gi, '"$1":"[REDACTED]"');
    s = s.replace(/admin_session=[^;"\s\\]+/gi, 'admin_session=[REDACTED]');
    return JSON.parse(s) as ErrorEvent;
  } catch {
    return event;
  }
}
