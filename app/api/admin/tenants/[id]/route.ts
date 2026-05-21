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

    // billingMode のバリデーション（不正値で Notion select に新規オプションが作られるのを防ぐ）
    const VALID_BILLING_MODES = ['無制限', '手動', 'Stripe連動'];
    if (
      'billingMode' in body &&
      body.billingMode != null &&
      !VALID_BILLING_MODES.includes(String(body.billingMode))
    ) {
      return NextResponse.json({ error: `不正な課金モード: ${body.billingMode}` }, { status: 400 });
    }

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

    // テナント行を取得（pageId 解決 + 課金モード判定に使用）
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const current = all.find((t) => t.pageId === id || t.tenantId === id);
    if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Stripe連動モードでは席数は Stripe が真実。手動での seatLimit 編集を禁止する。
    // 実効モード = リクエストで変更があればその値、なければ現在値（null は後方互換で Stripe連動 扱い）。
    const effectiveMode = 'billingMode' in body ? patch.billingMode : current.billingMode;
    if ((effectiveMode === 'Stripe連動' || effectiveMode == null) && 'seatLimit' in body) {
      return NextResponse.json(
        { error: 'Stripe連動モードでは席数を直接編集できません（席数は Stripe 契約と同期されます）' },
        { status: 400 }
      );
    }

    await updateTenantRow(current.pageId, patch);
    invalidateTenantCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
