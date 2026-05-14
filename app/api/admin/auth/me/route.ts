import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';
import { listAllTenants } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = verifySession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // master のみ全テナント一覧を返す
  let availableTenants: { id: string; name: string }[] = [];
  if (session.role === 'master') {
    try {
      const all = await listAllTenants();
      availableTenants = all.map((t) => ({ id: t.id, name: t.name }));
    } catch {
      availableTenants = [{ id: 'mewodas', name: 'メヲダス 五反田店' }];
    }
  }
  return NextResponse.json({
    email: session.email,
    role: session.role,
    currentTenantId: session.currentTenantId,
    availableTenants,
  });
}
