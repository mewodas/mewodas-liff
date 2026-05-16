import { createHmac, timingSafeEqual } from 'crypto';

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30日

function getSecret(): string {
  const s =
    process.env.INVITE_TOKEN_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.RESET_TOKEN_SECRET ||
    process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('INVITE_TOKEN_SECRET 未設定 (16文字以上の秘密鍵が必要)');
  }
  return s;
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64');
}

type InvitePayload = {
  customerId: string;
  tenantId: string;
  exp: number;
};

export function createInviteToken(payload: { customerId: string; tenantId: string }): string {
  const full: InvitePayload = { ...payload, exp: Date.now() + INVITE_TTL_MS };
  const body = b64urlEncode(JSON.stringify(full));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifyInviteToken(token: string | undefined | null): { customerId: string; tenantId: string } | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', getSecret()).update(body).digest();
  const provided = b64urlDecode(sig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as Partial<InvitePayload>;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    if (typeof parsed.customerId !== 'string' || typeof parsed.tenantId !== 'string') return null;
    return { customerId: parsed.customerId, tenantId: parsed.tenantId };
  } catch {
    return null;
  }
}
