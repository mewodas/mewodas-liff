import { NextResponse } from 'next/server';
import { updateStore, deleteStore } from '@/lib/stores';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const PATCH = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    await updateStore(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      storeId: typeof body.storeId === 'string' ? body.storeId : undefined,
      address: typeof body.address === 'string' ? body.address : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      hours: typeof body.hours === 'string' ? body.hours : undefined,
      manager: typeof body.manager === 'string' ? body.manager : undefined,
      signature: typeof body.signature === 'string' ? body.signature : undefined,
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
    await deleteStore(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
