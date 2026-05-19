// 前日レポート自動送信 Cron
//
// Vercel Cron が毎時 :00 に呼び出す。各テナントの autoSendTime と現在時刻を JST で比較し、
// 一致するテナントだけ「前日レポート」テンプレで全アクティブ顧客に送信。
//
// セキュリティ:
//   - Vercel Cron は CRON_SECRET ヘッダーをチェック（Authorization: Bearer xxx）
//   - 手動でも呼び出せるよう、env CRON_SECRET と一致すれば許可

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import { listTenantRows, listAllCustomers } from '@/lib/notion';
import { listRecordsInRange } from '@/lib/repository/records';
import { listTemplates } from '@/lib/templates';
import { getStoreByStoreId } from '@/lib/stores';
import { generateReportComments } from '@/lib/gemini';
import { createNotification, pushLineMessage } from '@/lib/notifications';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import type { TenantConfig } from '@/lib/tenant';
import { runInTenantContext } from '@/lib/tenantContext';
import { buildReportVariables } from '@/lib/reports/variables';
import { resolveDateRange } from '@/lib/reports/dateRange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function jstNow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return now;
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function tenantToConfig(r: Awaited<ReturnType<typeof listTenantRows>>[number]): TenantConfig {
  return {
    id: r.tenantId,
    name: r.name,
    notionApiKey: process.env.NOTION_API_KEY || '',
    notionCustomerDbId: r.customerDbId!,
    notionFoodDbId: r.foodDbId!,
    driveFolderId: process.env.DRIVE_PARENT_FOLDER_ID,
    geminiApiKey: process.env.GEMINI_API_KEY,
    gasEndpoint: process.env.GAS_RECORD_ENDPOINT,
    liffId: r.liffId ?? undefined,
    lineChannelToken: r.lineChannelToken ?? undefined,
    lineAutoSendEnabled: r.lineAutoSendEnabled,
    autoSendTime: r.autoSendTime ?? undefined,
    themeColor: '#059669',
    defaultGoals: { kcal: 2000, P: 100, F: 56, C: 275 },
  };
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  const now = jstNow();
  const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes() < 30 ? '00' : '30').padStart(2, '0')}`;
  const currentHourOnly = `${String(now.getHours()).padStart(2, '0')}:00`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = fmtDate(yesterday);

  // 全テナント取得
  const allTenants = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const targets = allTenants.filter((t) => {
    if (t.status === '解約') return false;
    if (!t.lineAutoSendEnabled) return false;
    if (!t.lineChannelToken) return false;
    if (!t.customerDbId || !t.foodDbId) return false;
    // 送信時刻チェック: 設定された時刻の "時" が現在の時と一致したら発火
    const sendTime = t.autoSendTime || '06:00';
    const sendHour = sendTime.slice(0, 2);
    const nowHour = currentHourOnly.slice(0, 2);
    return sendHour === nowHour;
  });

  const results: Array<{
    tenantId: string;
    tenantName: string;
    customers: number;
    sent: number;
    failed: number;
    errors: string[];
  }> = [];

  for (const t of targets) {
    const tenantConfig = tenantToConfig(t);
    const customers = await runInTenantContext(tenantConfig, () => listAllCustomers());
    // テンプレ取得（前日レポート優先）
    const templates = await runInTenantContext(tenantConfig, () => listTemplates());
    const dailyTemplate =
      templates.find((tpl) => tpl.category === '前日レポート' && !tpl.useAi && tpl.bodyTemplate) ||
      templates.find((tpl) => tpl.category === '前日レポート' && tpl.bodyTemplate) ||
      templates.find((tpl) => tpl.bodyTemplate);
    if (!dailyTemplate) {
      results.push({
        tenantId: t.tenantId,
        tenantName: t.name,
        customers: customers.length,
        sent: 0,
        failed: 0,
        errors: ['前日レポートテンプレが見つかりません'],
      });
      continue;
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 進行中の顧客に送信
    const activeCustomers = customers.filter((c) => c.foodStatus === '進行中' && c.lineUserId);

    await runInTenantContext(tenantConfig, async () => {
      for (const customer of activeCustomers) {
        try {
          // テンプレの rangeType に基づいて期間を決定（未設定の場合は昨日固定）
          const { startDate: reportStart, endDate: reportEnd } = resolveDateRange(
            dailyTemplate.rangeType,
            { startDate: yesterdayDate, endDate: yesterdayDate }
          );
          const records = await listRecordsInRange(customer.lineUserId, reportStart, reportEnd);
          const store = customer.storeId ? await getStoreByStoreId(customer.storeId).catch(() => null) : null;

          const isSingleDay = reportStart === reportEnd;
          const vars = buildReportVariables(records, customer, store, {
            startDate: reportStart,
            endDate: reportEnd,
            isSingleDay,
          });
          const sum = { kcal: Number(vars.kcal), P: Number(vars.P), F: Number(vars.F), C: Number(vars.C) };

          let body = applyVars(dailyTemplate.bodyTemplate, vars);
          const aiVars = Array.from(new Set(Array.from(body.matchAll(/\{(ai_\w+)\}/g), (m) => m[1])));
          if (aiVars.length > 0) {
            try {
              const aiComments = await generateReportComments({
                customerName: customer.name,
                date: reportEnd,
                sum: { kcal: Math.round(sum.kcal), P: Math.round(sum.P * 10) / 10, F: Math.round(sum.F * 10) / 10, C: Math.round(sum.C * 10) / 10 },
                goals: customer.goals,
                currentWeight: customer.currentWeight,
                targetWeight: customer.targetWeight,
                requiredKeys: aiVars,
              });
              body = body.replace(/\{(ai_\w+)\}/g, (_, k) => aiComments[k] ?? `{${k}}`);
            } catch (e) {
              // AI失敗時はプレースホルダのまま残す
              errors.push(`${customer.name}: AI生成失敗 ${e instanceof Error ? e.message : ''}`);
            }
          }

          const title = dailyTemplate.titleTemplate
            ? applyVars(dailyTemplate.titleTemplate, vars)
            : `${reportEnd} の振り返り`;

          // 通知DB に保存
          await createNotification({
            lineUserId: customer.lineUserId,
            customerName: customer.name,
            category: '前日レポート',
            title,
            body,
            staffName: store?.name || '',
          }).catch(() => null);

          // LINE push
          const pushResult = await pushLineMessage(customer.lineUserId, title, body, store?.name || '', {
            tokenOverride: t.lineChannelToken!,
          });
          if (pushResult.pushed) {
            sentCount++;
          } else {
            failedCount++;
            errors.push(`${customer.name}: ${pushResult.reason}`);
          }
        } catch (e) {
          failedCount++;
          errors.push(`${customer.name}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
    });

    results.push({
      tenantId: t.tenantId,
      tenantName: t.name,
      customers: activeCustomers.length,
      sent: sentCount,
      failed: failedCount,
      errors: errors.slice(0, 10),
    });
  }

  return NextResponse.json({
    ok: true,
    executedAt: now.toISOString(),
    elapsedMs: Date.now() - startedAt,
    currentJstTime: currentHourMin,
    targetTenants: targets.length,
    results,
  });
}
