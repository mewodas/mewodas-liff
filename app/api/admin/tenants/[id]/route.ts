import { NextResponse } from 'next/server';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withMasterOnly(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const tenant = all.find((t) => t.pageId === id || t.tenantId === id);
    if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const PATCH = withMasterOnly(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: { liffId?: string | null; plan?: string; ownerEmail?: string; status?: string; note?: string } = {};
    if ('liffId' in body) patch.liffId = body.liffId ? String(body.liffId).trim() : null;
    if ('plan' in body && body.plan) patch.plan = String(body.plan);
    if ('ownerEmail' in body && body.ownerEmail) patch.ownerEmail = String(body.ownerEmail);
    if ('status' in body && body.status) patch.status = String(body.status);
    if ('note' in body) patch.note = String(body.note || '');

    // pageId 必要：tenantId 文字列で来たら一覧から解決
    let pageId = id;
    if (!id.includes('-') && id.length !== 32) {
      const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
      const t = all.find((x) => x.tenantId === id);
      if (!t) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      pageId = t.pageId;
    }

    await updateTenantRow(pageId, patch);
    invalidateTenantCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
