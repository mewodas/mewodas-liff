import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { generateInviteToken, type InviteKind } from '@/lib/inviteToken';
import { logAuditEvent } from '@/lib/auditLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 招待URL生成（個別招待 = 既定 7 日有効）
// 認証: admin セッション Cookie 必須。現在テナント宛の招待を発行する
export const POST = withAdminTenant(async (req: NextRequest) => {
  let body: { expiresInDays?: number; kind?: InviteKind } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const expiresInDays = Math.min(Math.max(body.expiresInDays ?? 7, 1), 30);
  const kind: InviteKind = body.kind === 'approval' ? 'approval' : 'individual';

  const session = currentSession(req);
  const tenant = getCurrentTenant();

  let token: string;
  try {
    token = generateInviteToken({ tenantId: tenant.id, expiresInDays, kind });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  logAuditEvent({ action: 'invite.create', outcome: 'success', actorType: session?.role === 'master' ? 'master' : 'admin', actorId: session?.email, tenantId: tenant.id, metadata: { kind, expiresInDays } });
  return NextResponse.json({
    token,
    tenantId: tenant.id,
    tenantName: tenant.name,
    expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    expiresInDays,
    kind,
  });
});
