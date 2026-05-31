// 招待トークン（HMAC-SHA256 署名）
//
// 用途: ジムが顧客に配布する個別招待URL。テナントIDを改ざん不可能な形で URL に埋め込む。
// 形式: `<b64url(JSON payload)>.<b64url(HMAC-SHA256)>`
// 期限: 既定 7 日（1〜30 日でクランプ）
// 秘密鍵: INVITE_TOKEN_SECRET（無ければ ADMIN_SESSION_SECRET をフォールバック）

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

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

export type InviteKind = 'individual' | 'approval';

export type InvitePayload = {
  tenantId: string;
  exp: number;      // unix ms
  nonce: string;
  kind: InviteKind;
  /** トークン種別。セッション/リセット等への流用防止（同一秘密鍵での cross-protocol 対策）。 */
  typ?: 'invite';
};

export function generateInviteToken(opts: {
  tenantId: string;
  expiresInDays?: number;
  kind?: InviteKind;
}): string {
  const days = Math.min(Math.max(opts.expiresInDays ?? 7, 1), 30);
  const payload: InvitePayload = {
    tenantId: opts.tenantId,
    exp: Date.now() + days * 24 * 60 * 60 * 1000,
    nonce: randomBytes(8).toString('hex'),
    kind: opts.kind ?? 'individual',
    typ: 'invite',
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifyInviteToken(token: string): InvitePayload | null {
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
  let parsed: Partial<InvitePayload>;
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as Partial<InvitePayload>;
  } catch {
    return null;
  }
  // typ がある場合は 'invite' のみ受理（他用途トークンの流用拒否）。無い場合は後方互換で許容。
  if (parsed.typ !== undefined && parsed.typ !== 'invite') return null;
  if (typeof parsed.tenantId !== 'string' || !parsed.tenantId) return null;
  if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
  return {
    tenantId: parsed.tenantId,
    exp: parsed.exp,
    nonce: typeof parsed.nonce === 'string' ? parsed.nonce : '',
    kind: parsed.kind === 'approval' ? 'approval' : 'individual',
  };
}
