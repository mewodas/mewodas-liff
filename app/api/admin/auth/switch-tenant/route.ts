import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';
import { getTenantByIdAsync } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = verifySession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'master') {
    return NextResponse.json({ error: 'master only' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const tenantId = String(body.tenantId || '').trim();
  if (!tenantId) return NextResponse.json({ error: 'tenantId 必須' }, { status: 400 });

  const target = await getTenantByIdAsync(tenantId);
  if (!target) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });

  const cookie = createSessionCookie(session.email, {
    role: session.role,
    currentTenantId: tenantId,
  });
  const res = NextResponse.json({ ok: true, currentTenantId: tenantId });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
