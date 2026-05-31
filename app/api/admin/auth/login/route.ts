import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionCookie,
  getAdminCredentials,
  verifyPassword,
} from '@/lib/adminAuth';
import { findTenantAdminByEmail } from '@/lib/tenantResolver';
import { logAuditEvent } from '@/lib/auditLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- 簡易ブルートフォース対策（per-instance in-memory）---
// email / IP ごとに失敗を集計し、一定回数で一時ロック。reset-password と同じ in-memory 方式。
// 永続レート制限（Neon/Upstash で全インスタンス共有）は設計#7で別途強化予定。
type LoginAttempt = { count: number; windowStart: number; lockedUntil: number };
const loginAttempts = new Map<string, LoginAttempt>();
const LOGIN_WINDOW_MS = 15 * 60_000; // 集計ウィンドウ 15分
const LOGIN_MAX_FAILS = 8; // ウィンドウ内 8 回失敗で
const LOGIN_LOCK_MS = 15 * 60_000; // 15分ロック
const LOGIN_MAX_KEYS = 5000; // メモリ保護（簡易上限）

function loginRlRetryAfter(keys: string[]): number | null {
  const now = Date.now();
  let retry: number | null = null;
  for (const k of keys) {
    const a = loginAttempts.get(k);
    if (a && a.lockedUntil > now) {
      retry = Math.max(retry ?? 0, Math.ceil((a.lockedUntil - now) / 1000));
    }
  }
  return retry;
}

function loginRlFail(keys: string[]): void {
  const now = Date.now();
  if (loginAttempts.size > LOGIN_MAX_KEYS) loginAttempts.clear();
  for (const k of keys) {
    let a = loginAttempts.get(k);
    if (!a || now - a.windowStart > LOGIN_WINDOW_MS) {
      a = { count: 0, windowStart: now, lockedUntil: 0 };
    }
    a.count++;
    if (a.count >= LOGIN_MAX_FAILS) a.lockedUntil = now + LOGIN_LOCK_MS;
    loginAttempts.set(k, a);
  }
}

function loginRlReset(keys: string[]): void {
  for (const k of keys) loginAttempts.delete(k);
}

export async function POST(req: NextRequest) {
  let email: string;
  let password: string;
  try {
    const body = await req.json();
    email = String(body.email || '').trim().toLowerCase();
    password = String(body.password || '');
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!email || !password) {
    return NextResponse.json({ error: 'email/password 必須' }, { status: 400 });
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  // ブルートフォース・ロックアウト判定（email と IP の両方）
  const rlKeys = [`email:${email}`, `ip:${ip ?? 'unknown'}`];
  const retryAfter = loginRlRetryAfter(rlKeys);
  if (retryAfter !== null) {
    logAuditEvent({ action: 'auth.login', outcome: 'failure', actorType: 'admin', actorId: email, ip, userAgent, metadata: { reason: 'rate_limited' } });
    return NextResponse.json(
      { error: 'ログイン試行が多すぎます。しばらく待ってから再度お試しください' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // ① マスタログイン（env ADMIN_EMAIL）— パスワード一致時のみ通す。
  //    一致しない場合は tenant_admin 認証へフォールバック（同じメールが両方に登録されているケースに対応）
  const masterCreds = getAdminCredentials();
  if (masterCreds && email === masterCreds.email.toLowerCase()) {
    if (verifyPassword(password, masterCreds.passwordHash)) {
      loginRlReset(rlKeys);
      logAuditEvent({ action: 'auth.login', outcome: 'success', actorType: 'master', actorId: email, tenantId: 'mewodas', ip, userAgent });
      const cookie = createSessionCookie(email, { role: 'master', currentTenantId: 'mewodas' });
      const res = NextResponse.json({ ok: true, email, role: 'master', currentTenantId: 'mewodas' });
      res.cookies.set(cookie.name, cookie.value, cookie.options);
      return res;
    }
    // パスワード不一致 → tenant_admin 経路へフォールスルー
  }

  // ② テナント admin ログイン（FitMeal テナント DB から検索）
  try {
    const tenant = await findTenantAdminByEmail(email);
    if (!tenant) {
      loginRlFail(rlKeys);
      logAuditEvent({ action: 'auth.login', outcome: 'failure', actorType: 'admin', actorId: email, ip, userAgent, metadata: { reason: 'tenant_not_found' } });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    if (!verifyPassword(password, tenant.passwordHash)) {
      loginRlFail(rlKeys);
      logAuditEvent({ action: 'auth.login', outcome: 'failure', actorType: 'admin', actorId: email, tenantId: tenant.tenantId, ip, userAgent, metadata: { reason: 'wrong_password' } });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    loginRlReset(rlKeys);
    logAuditEvent({ action: 'auth.login', outcome: 'success', actorType: 'admin', actorId: email, tenantId: tenant.tenantId, ip, userAgent });
    const cookie = createSessionCookie(email, { role: 'tenant_admin', currentTenantId: tenant.tenantId });
    const res = NextResponse.json({ ok: true, email, role: 'tenant_admin', currentTenantId: tenant.tenantId, tenantName: tenant.tenantName });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
