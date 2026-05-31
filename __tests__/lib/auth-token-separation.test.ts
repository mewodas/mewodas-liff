// P0 CRITICAL 回帰テスト: トークン purpose 分離（2026-05-31 修正）。
//
// 封鎖した脆弱性:
//   パスワードリセットトークン（email+exp を持ち、同じ ADMIN_SESSION_SECRET で署名）を
//   admin_session Cookie に入れると verifySession が role 欠落→master と推定して通し、
//   店舗オーナーが運営(master)へ自己昇格できた。
// 本テストは「session 専用トークンのみ verifySession を通る」「role 欠落は拒否」を保証する。

import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'crypto';

const SECRET = 'test-admin-session-secret-0123456789abcdef';
process.env.ADMIN_SESSION_SECRET = SECRET;
beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
});

import { signSession, verifySession } from '@/lib/adminAuth';
import { signResetToken, verifyResetToken } from '@/lib/passwordReset';
import { generateInviteToken } from '@/lib/inviteToken';

function b64url(s: string | Buffer): string {
  const b = typeof s === 'string' ? Buffer.from(s) : s;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// 同じ秘密鍵・同じ形式で任意ペイロードを「正しく署名」する（legacy/欠落シナリオの再現用）
function forgeValidlySignedToken(payload: object): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', SECRET).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

const future = () => Date.now() + 60_000;

describe('verifySession — session 専用トークンのみ受理', () => {
  it('正規セッションは round-trip し role/tenant を保持する', () => {
    const token = signSession({ email: 'a@b.co', exp: future(), role: 'tenant_admin', currentTenantId: 't1' });
    const s = verifySession(token);
    expect(s).not.toBeNull();
    expect(s!.email).toBe('a@b.co');
    expect(s!.role).toBe('tenant_admin');
    expect(s!.currentTenantId).toBe('t1');
  });

  it('★ パスワードリセットトークンを admin_session として使えない（master 昇格封鎖）', () => {
    const reset = signResetToken({ email: 'gym@owner.co', tenantId: 't1' });
    expect(verifySession(reset)).toBeNull();
  });

  it('★ 招待トークンを admin_session として使えない', () => {
    const invite = generateInviteToken({ tenantId: 't1' });
    expect(verifySession(invite)).toBeNull();
  });

  it('★ typ を持たない旧セッション（legacy）は拒否される（master 既定の廃止）', () => {
    const legacy = forgeValidlySignedToken({ email: 'a@b.co', exp: future() }); // role/typ なし
    expect(verifySession(legacy)).toBeNull();
  });

  it('★ typ=session でも role 欠落なら拒否（fail-closed・master 推定なし）', () => {
    const noRole = forgeValidlySignedToken({ email: 'a@b.co', exp: future(), typ: 'session', currentTenantId: 't1' });
    expect(verifySession(noRole)).toBeNull();
  });

  it('未知の role 値は拒否される', () => {
    const badRole = forgeValidlySignedToken({ email: 'a@b.co', exp: future(), typ: 'session', role: 'superadmin', currentTenantId: 't1' });
    expect(verifySession(badRole)).toBeNull();
  });

  it('currentTenantId 欠落は拒否される（mewodas 既定の廃止）', () => {
    const noTenant = forgeValidlySignedToken({ email: 'a@b.co', exp: future(), typ: 'session', role: 'master' });
    expect(verifySession(noTenant)).toBeNull();
  });

  it('期限切れトークンは拒否', () => {
    const expired = signSession({ email: 'a@b.co', exp: Date.now() - 1000, role: 'master', currentTenantId: 'mewodas' });
    expect(verifySession(expired)).toBeNull();
  });

  it('署名改ざんトークンは拒否', () => {
    const token = signSession({ email: 'a@b.co', exp: future(), role: 'master', currentTenantId: 'mewodas' });
    const last = token.slice(-1);
    const tampered = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    expect(verifySession(tampered)).toBeNull();
  });

  it('別の秘密鍵で署名されたトークンは拒否', () => {
    const body = b64url(JSON.stringify({ email: 'a@b.co', exp: future(), typ: 'session', role: 'master', currentTenantId: 'mewodas' }));
    const sig = createHmac('sha256', 'a-different-secret-0123456789abc').update(body).digest();
    expect(verifySession(`${body}.${b64url(sig)}`)).toBeNull();
  });

  it('空・不正形式トークンは拒否', () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession('')).toBeNull();
    expect(verifySession('no-dot-token')).toBeNull();
  });
});

describe('verifyResetToken — reset 専用トークンのみ受理（逆方向の混同も封鎖）', () => {
  it('正規リセットトークンは round-trip する', () => {
    const reset = signResetToken({ email: 'gym@owner.co', tenantId: 't1' });
    const r = verifyResetToken(reset);
    expect(r).not.toBeNull();
    expect(r!.email).toBe('gym@owner.co');
    expect(r!.tenantId).toBe('t1');
  });

  it('★ セッショントークンをリセットトークンとして使えない', () => {
    const session = signSession({ email: 'a@b.co', exp: future(), role: 'master', currentTenantId: 'mewodas' });
    expect(verifyResetToken(session)).toBeNull();
  });

  it('★ 招待トークンをリセットトークンとして使えない', () => {
    const invite = generateInviteToken({ tenantId: 't1' });
    expect(verifyResetToken(invite)).toBeNull();
  });
});
