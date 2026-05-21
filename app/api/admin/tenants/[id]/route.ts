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
    const patch: {
      liffId?: string | null;
      plan?: string;
      ownerEmail?: string;
      status?: string;
      note?: string;
      lineChannelToken?: string | null;
      lineAutoSendEnabled?: boolean;
      autoSendTime?: string | null;
      billingMode?: '無制限' | '手動' | 'Stripe連動' | null;
      seatLimit?: number | null;
      planCode?: string | null;
    } = {};
    if ('liffId' in body) patch.liffId = body.liffId ? String(body.liffId).trim() : null;
    if ('plan' in body && body.plan) patch.plan = String(body.plan);
    if ('ownerEmail' in body && body.ownerEmail) patch.ownerEmail = String(body.ownerEmail);
    if ('status' in body && body.status) patch.status = String(body.status);
    if ('note' in body) patch.note = String(body.note || '');
    if ('lineChannelToken' in body) patch.lineChannelToken = body.lineChannelToken ? String(body.lineChannelToken).trim() : null;
    if ('lineAutoSendEnabled' in body) patch.lineAutoSendEnabled = !!body.lineAutoSendEnabled;
    if ('autoSendTime' in body) patch.autoSendTime = body.autoSendTime ? String(body.autoSendTime).trim() : null;
    if ('billingMode' in body) patch.billingMode = body.billingMode || null;
    if ('seatLimit' in body) patch.seatLimit = body.seatLimit !== null && body.seatLimit !== undefined ? Number(body.seatLimit) : null;
    if ('planCode' in body) patch.planCode = body.planCode ? String(body.planCode).trim() : null;

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
