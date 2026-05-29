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

  // ① マスタログイン（env ADMIN_EMAIL）— パスワード一致時のみ通す。
  //    一致しない場合は tenant_admin 認証へフォールバック（同じメールが両方に登録されているケースに対応）
  const masterCreds = getAdminCredentials();
  if (masterCreds && email === masterCreds.email.toLowerCase()) {
    if (verifyPassword(password, masterCreds.passwordHash)) {
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
      logAuditEvent({ action: 'auth.login', outcome: 'failure', actorType: 'admin', actorId: email, ip, userAgent, metadata: { reason: 'tenant_not_found' } });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    if (!verifyPassword(password, tenant.passwordHash)) {
      logAuditEvent({ action: 'auth.login', outcome: 'failure', actorType: 'admin', actorId: email, tenantId: tenant.tenantId, ip, userAgent, metadata: { reason: 'wrong_password' } });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    logAuditEvent({ action: 'auth.login', outcome: 'success', actorType: 'admin', actorId: email, tenantId: tenant.tenantId, ip, userAgent });
    const cookie = createSessionCookie(email, { role: 'tenant_admin', currentTenantId: tenant.tenantId });
    const res = NextResponse.json({ ok: true, email, role: 'tenant_admin', currentTenantId: tenant.tenantId, tenantName: tenant.tenantName });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
