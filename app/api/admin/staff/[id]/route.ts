import { NextResponse } from 'next/server';
import { updateStaff, deleteStaff, isStaffConfigured } from '@/lib/staff';
import { withAdminTenant, currentSession } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// スタッフDBはテナント横断（tenant_id 列なし）。テナント別分離が入るまでは運営(master)専用に限定。
function ensureMaster(req: import('next/server').NextRequest): NextResponse | null {
  const session = currentSession(req);
  if (session?.role !== 'master') {
    return NextResponse.json({ error: 'master only' }, { status: 403 });
  }
  return null;
}

export const PATCH = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = ensureMaster(req);
  if (denied) return denied;
  if (!isStaffConfigured()) return NextResponse.json({ error: 'NOTION_STAFF_DB_ID 未設定' }, { status: 503 });
  try {
    const { id } = await params;
    const body = await req.json();
    await updateStaff(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      shop: typeof body.shop === 'string' ? body.shop : undefined,
      role: typeof body.role === 'string' ? body.role : undefined,
      active: typeof body.active === 'boolean' ? body.active : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const DELETE = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = ensureMaster(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    await deleteStaff(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
