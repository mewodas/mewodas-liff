import { NextResponse } from 'next/server';
import {
  isScheduledReportsConfigured,
  listRulesForTenant,
  listAllRules,
  createRule,
  type ScheduledReportAudience,
  type ScheduledReportFrequency,
} from '@/lib/scheduledReports';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async (req) => {
  if (!isScheduledReportsConfigured()) {
    return NextResponse.json({ configured: false, rules: [] });
  }
  const session = currentSession(req);
  const isMaster = session?.role === 'master';
  const tenantId = getCurrentTenant().id;

  let rules = isMaster ? await listAllRules() : await listRulesForTenant(tenantId);
  if (!isMaster) {
    rules = rules.filter((r) => r.tenantId === tenantId);
  }
  return NextResponse.json({ configured: true, rules });
});

export const POST = withAdminTenant(async (req) => {
  if (!isScheduledReportsConfigured()) {
    return NextResponse.json(
      { error: 'SCHEDULED_REPORTS_DB_ID 未設定' },
      { status: 503 }
    );
  }
  try {
    const body = await req.json();
    const session = currentSession(req);
    const isMaster = session?.role === 'master';
    const contextTenantId = getCurrentTenant().id;

    const tenantId = isMaster
      ? String(body.tenantId || contextTenantId).trim() || contextTenantId
      : contextTenantId;

    const name = String(body.name || '').trim();
    const templateName = String(body.templateName || '').trim();
    const time = String(body.time || '').trim();
    const frequency = body.frequency as ScheduledReportFrequency;
    const audience = (body.audience as ScheduledReportAudience) || '全顧客';
    const saveInApp = !!body.saveInApp;
    const sendLine = !!body.sendLine;
    const enabled = body.enabled !== false;

    if (!name) return NextResponse.json({ error: 'ルール名は必須です' }, { status: 400 });
    if (!templateName) return NextResponse.json({ error: 'テンプレ名は必須です' }, { status: 400 });
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: '時刻は HH:MM 形式で入力してください' }, { status: 400 });
    }
    const FREQUENCIES: ScheduledReportFrequency[] = ['毎日', '毎週', '毎月'];
    if (!FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: '頻度が不正です' }, { status: 400 });
    }
    if (frequency === '毎週') {
      const weekdays: string[] = Array.isArray(body.weekdays) ? body.weekdays : [];
      if (weekdays.length === 0) {
        return NextResponse.json({ error: '毎週の場合は曜日を1つ以上選択してください' }, { status: 400 });
      }
    }
    if (frequency === '毎月') {
      const dayOfMonth = typeof body.dayOfMonth === 'number' ? body.dayOfMonth : null;
      if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) {
        return NextResponse.json({ error: '毎月の場合は日（1〜31）を指定してください' }, { status: 400 });
      }
    }
    if (!saveInApp && !sendLine) {
      return NextResponse.json({ error: 'アプリ内保存・LINE送信のいずれかを選択してください' }, { status: 400 });
    }

    const rule = await createRule({
      tenantId,
      name,
      templateName,
      audience,
      targetStoreId: audience === '店舗' ? (String(body.targetStoreId || '').trim() || null) : null,
      frequency,
      weekdays: Array.isArray(body.weekdays) ? body.weekdays : [],
      dayOfMonth: typeof body.dayOfMonth === 'number' ? body.dayOfMonth : null,
      time,
      saveInApp,
      sendLine,
      enabled,
    });

    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
