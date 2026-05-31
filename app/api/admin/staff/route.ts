import { NextResponse } from 'next/server';
import { listStaff, createStaff, isStaffConfigured } from '@/lib/staff';
import { withAdminTenant, currentSession } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// スタッフDBはテナント横断（tenant_id 列なし）。テナント別分離が入るまでは運営(master)専用に限定し、
// 店舗(tenant_admin)による全テナント分のスタッフ閲覧/改竄を防ぐ。
function ensureMaster(req: import('next/server').NextRequest): NextResponse | null {
  const session = currentSession(req);
  if (session?.role !== 'master') {
    return NextResponse.json({ error: 'master only' }, { status: 403 });
  }
  return null;
}

export const GET = withAdminTenant(async (req) => {
  const denied = ensureMaster(req);
  if (denied) return denied;
  if (!isStaffConfigured()) return NextResponse.json({ configured: false, staff: [] });
  const staff = await listStaff();
  return NextResponse.json({ configured: true, staff });
});

export const POST = withAdminTenant(async (req) => {
  const denied = ensureMaster(req);
  if (denied) return denied;
  if (!isStaffConfigured()) {
    return NextResponse.json({ error: 'NOTION_STAFF_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: '名前必須' }, { status: 400 });
    const staff = await createStaff({
      name,
      shop: String(body.shop || '').trim(),
      role: String(body.role || '').trim(),
    });
    return NextResponse.json({ ok: true, staff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
