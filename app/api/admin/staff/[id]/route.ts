import { NextResponse } from 'next/server';
import { updateStaff, deleteStaff, isStaffConfigured } from '@/lib/staff';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const PATCH = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
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

export const DELETE = withAdminTenant(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    await deleteStaff(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
