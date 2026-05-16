// パスワード再設定トークン（HMAC署名付き、サーバー側状態不要）
//
// フロー:
// 1. ユーザーがメール入力 → signResetToken でトークン生成
// 2. メールに /store/account/reset/confirm?token=xxx のURLを記載
// 3. ユーザーがリンクをタップ → ページで新パスワード入力
// 4. /api/admin/auth/reset-password/confirm に token + newPassword を POST
// 5. verifyResetToken で検証 → パスワードハッシュ更新

import { createHmac, timingSafeEqual } from 'crypto';

const RESET_TTL_MS = 60 * 60 * 1000; // 1時間

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET 未設定 (16文字以上必要)');
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

type ResetPayload = {
  email: string;
  tenantId: string;
  exp: number;
};

export function signResetToken(payload: { email: string; tenantId: string }): string {
  const full: ResetPayload = { ...payload, exp: Date.now() + RESET_TTL_MS };
  const body = b64urlEncode(JSON.stringify(full));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifyResetToken(token: string | undefined | null): { email: string; tenantId: string } | null {
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
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as Partial<ResetPayload>;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (typeof payload.email !== 'string' || typeof payload.tenantId !== 'string') return null;
    return { email: payload.email, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}
