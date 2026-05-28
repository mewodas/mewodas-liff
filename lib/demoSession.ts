// デモセッション（HMAC-SHA256 署名）
//
// 用途: 営業・LP・トライアル冒頭で LINE ログインなしに顧客 LIFF 画面をサンプルデータで体験させる。
// 形式: `<b64url(JSON payload)>.<b64url(HMAC-SHA256)>`
// 期限: 365日（固定）
// 秘密鍵: INVITE_TOKEN_SECRET または ADMIN_SESSION_SECRET（inviteToken.ts と同様）
// セキュリティ: テナントはトークン内 tenantId のみで解決（改ざん防止）、非 GET は withLiffTenant で 403。

import { createHmac, timingSafeEqual } from 'crypto';

function getSecret(): string {
  const s = process.env.INVITE_TOKEN_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('INVITE_TOKEN_SECRET (or ADMIN_SESSION_SECRET) is not configured (16+ chars required)');
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

export type DemoPayload = {
  tenantId: string;
  lineUserId: string;
  kind: 'demo' | 'preview';
  exp: number;
};

export function generateDemoToken(opts: { tenantId: string; lineUserId: string }): string {
  const payload: DemoPayload = {
    tenantId: opts.tenantId,
    lineUserId: opts.lineUserId,
    kind: 'demo',
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function generatePreviewToken(opts: { tenantId: string; lineUserId: string }): string {
  const payload: DemoPayload = {
    tenantId: opts.tenantId,
    lineUserId: opts.lineUserId,
    kind: 'preview',
    exp: Date.now() + 60 * 60 * 1000,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifyDemoToken(token: string): DemoPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected: Buffer;
  try {
    expected = createHmac('sha256', getSecret()).update(body).digest();
  } catch {
    return null;
  }
  const provided = b64urlDecode(sig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  let parsed: Partial<DemoPayload>;
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as Partial<DemoPayload>;
  } catch {
    return null;
  }
  if (typeof parsed.tenantId !== 'string' || !parsed.tenantId) return null;
  if (typeof parsed.lineUserId !== 'string' || !parsed.lineUserId) return null;
  if (parsed.kind !== 'demo' && parsed.kind !== 'preview') return null;
  if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
  return {
    tenantId: parsed.tenantId,
    lineUserId: parsed.lineUserId,
    kind: parsed.kind,
    exp: parsed.exp,
  };
}
