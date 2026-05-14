import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionCookie,
  getAdminCredentials,
  verifyPassword,
} from '@/lib/adminAuth';

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
  const creds = getAdminCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL / ADMIN_PASSWORD_HASH が未設定です' },
      { status: 500 }
    );
  }
  if (email !== creds.email.toLowerCase()) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }
  if (!verifyPassword(password, creds.passwordHash)) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  // env の ADMIN_EMAIL とログインメールが一致するのでマスタ確定
  const cookie = createSessionCookie(email, { role: 'master', currentTenantId: 'mewodas' });
  const res = NextResponse.json({ ok: true, email, role: 'master' });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
