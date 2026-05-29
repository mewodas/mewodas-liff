import { NextResponse } from 'next/server';
import {
  isScheduledReportsConfigured,
  listRulesForTenant,
  listAllRules,
  updateRule,
  deleteRule,
  type ScheduledReportAudience,
  type ScheduledReportFrequency,
} from '@/lib/scheduledReports';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function resolveRule(id: string, tenantId: string, isMaster: boolean) {
  const rules = isMaster ? await listAllRules() : await listRulesForTenant(tenantId);
  return rules.find((r) => r.id === id) ?? null;
}

export const PATCH = withAdminTenant(async (req, ctx) => {
  if (!isScheduledReportsConfigured()) {
    return NextResponse.json({ error: 'SCHEDULED_REPORTS_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const { id } = await ctx.params;
    const session = currentSession(req);
    const isMaster = session?.role === 'master';
    const tenantId = getCurrentTenant().id;

    const existing = await resolveRule(id, tenantId, isMaster);
    if (!existing) return NextResponse.json({ error: 'ルールが見つかりません' }, { status: 404 });
    if (!isMaster && existing.tenantId !== tenantId) {
      return NextResponse.json({ error: '他テナントのルールは操作できません' }, { status: 403 });
    }

    const body = await req.json();
    const patch: Parameters<typeof updateRule>[1] = {};

    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.templateName !== undefined) patch.templateName = String(body.templateName).trim();
    if (body.audience !== undefined) patch.audience = body.audience as ScheduledReportAudience;
    if (body.targetStoreId !== undefined) patch.targetStoreId = body.targetStoreId || null;
    if (body.frequency !== undefined) patch.frequency = body.frequency as ScheduledReportFrequency;
    if (body.weekdays !== undefined) patch.weekdays = Array.isArray(body.weekdays) ? body.weekdays : [];
    if (body.dayOfMonth !== undefined) {
      patch.dayOfMonth = typeof body.dayOfMonth === 'number' ? body.dayOfMonth : null;
    }
    if (body.time !== undefined) patch.time = String(body.time).trim();
    if (body.saveInApp !== undefined) patch.saveInApp = !!body.saveInApp;
    if (body.sendLine !== undefined) patch.sendLine = !!body.sendLine;
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;

    const rule = await updateRule(id, patch);
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const DELETE = withAdminTenant(async (req, ctx) => {
  if (!isScheduledReportsConfigured()) {
    return NextResponse.json({ error: 'SCHEDULED_REPORTS_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const { id } = await ctx.params;
    const session = currentSession(req);
    const isMaster = session?.role === 'master';
    const tenantId = getCurrentTenant().id;

    const existing = await resolveRule(id, tenantId, isMaster);
    if (!existing) return NextResponse.json({ error: 'ルールが見つかりません' }, { status: 404 });
    if (!isMaster && existing.tenantId !== tenantId) {
      return NextResponse.json({ error: '他テナントのルールは操作できません' }, { status: 403 });
    }

    await deleteRule(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
