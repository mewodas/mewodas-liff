import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'crypto';

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日

export type AdminRole = 'master' | 'tenant_admin';

export type SessionPayload = {
  email: string;
  exp: number;
  /** master = FitMeal経営者、tenant_admin = ジム経営者 */
  role: AdminRole;
  /** 現在操作中のテナントID。master の場合は切替可能、tenant_admin の場合は固定 */
  currentTenantId: string;
  /** トークン種別。セッション専用署名であることを示し、リセット/招待トークン（同一秘密鍵で署名）との混同を防ぐ。 */
  typ?: 'session';
};

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

export function signSession(payload: SessionPayload): string {
  // typ='session' を必ず刻む。同じ ADMIN_SESSION_SECRET で署名されるリセット/招待トークンが
  // セッションとして検証を通過する cross-protocol 混同（→ master 昇格）を防ぐ。
  const body = b64urlEncode(JSON.stringify({ ...payload, typ: 'session' as const }));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
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
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as Partial<SessionPayload>;
    // ★ purpose 判別: セッション専用トークンのみ受理。
    //   同一秘密鍵で署名されたパスワードリセットトークン（email+exp を持つ）が
    //   admin_session Cookie として master 昇格に悪用される脆弱性を塞ぐ。
    //   typ を持たない旧セッションも無効化（→ 一度だけ再ログインが必要、これは意図的）。
    if (payload.typ !== 'session') return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (typeof payload.email !== 'string') return null;
    // ★ role 欠落を master と推定しない（最小権限・fail-closed）。
    if (payload.role !== 'master' && payload.role !== 'tenant_admin') return null;
    if (typeof payload.currentTenantId !== 'string' || !payload.currentTenantId) return null;
    return {
      email: payload.email,
      exp: payload.exp,
      role: payload.role,
      currentTenantId: payload.currentTenantId,
    };
  } catch {
    return null;
  }
}

// パスワードハッシュ：scrypt（saltつき）
// 環境変数 ADMIN_PASSWORD_HASH には `scrypt$<saltHex>$<hashHex>` 形式で格納
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function getAdminCredentials(): { email: string; passwordHash: string } | null {
  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!email || !passwordHash) return null;
  return { email, passwordHash };
}

export function createSessionCookie(
  email: string,
  opts?: { role?: AdminRole; currentTenantId?: string }
): { name: string; value: string; options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number } } {
  const value = signSession({
    email,
    exp: Date.now() + SESSION_TTL_MS,
    role: opts?.role ?? 'master',
    currentTenantId: opts?.currentTenantId ?? 'mewodas',
  });
  return {
    name: SESSION_COOKIE,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    },
  };
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    },
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
