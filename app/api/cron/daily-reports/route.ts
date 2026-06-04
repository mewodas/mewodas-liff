// 定期レポート自動送信 Cron
//
// Vercel Cron が毎時 :00 に呼び出す。「FitMeal 定期配信ルール」DB の有効ルールを
// 取得し、各ルールの頻度・時刻と現在 JST 時刻を照合して発火。
//
// セキュリティ:
//   - CRON_SECRET ヘッダーをチェック（Authorization: Bearer xxx）

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import { listTenantRows, listAllCustomers, getWeightBoundsInRange } from '@/lib/notion';
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
import { listAllRules, isScheduledReportsConfigured } from '@/lib/scheduledReports';
import { computeAndStoreTenantRisk } from '@/lib/customerRiskService';
import { listCustomerRiskByTenant } from '@/lib/repository/customerRisk';
import { createAnnouncement, listAllAnnouncementsAdmin, isAnnouncementsConfigured } from '@/lib/announcements';
import type { CustomerRiskRow } from '@/lib/repository/customerRisk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function jstNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// JST 曜日インデックス 0=日〜6=土 を日本語曜日名に変換
const JST_WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;

const CURRENT_ENV = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development';

/**
 * 月末フォールバック: 対象月に dayOfMonth が存在しない場合は末日を返す。
 * 例: dayOfMonth=31 で 2月 → 28 or 29 日
 */
function resolveMonthDay(now: Date, dayOfMonth: number): number {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(dayOfMonth, lastDay);
}

/**
 * ルールが now（JST）で発火すべきか判定。
 * 本番Vercelが Hobbyプランのため cron は日次1回（vercel.json: 朝6時JST想定）。
 * よって「時刻」は発火判定に使わず（時刻指定はPro移行で毎時化した際に有効化）、
 * 「今日が配信日か」（毎日/毎週の曜日/毎月の日）だけで判定する。
 */
function shouldFire(rule: { frequency: string; weekdays: string[]; dayOfMonth: number | null; time: string }, now: Date): boolean {
  if (rule.frequency === '毎日') return true;

  if (rule.frequency === '毎週') {
    const todayWeekday = JST_WEEKDAY_NAMES[now.getDay()];
    return rule.weekdays.includes(todayWeekday);
  }

  if (rule.frequency === '毎月') {
    if (rule.dayOfMonth === null) return false;
    const targetDay = resolveMonthDay(now, rule.dayOfMonth);
    return now.getDate() === targetDay;
  }

  return false;
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
    riskAlertEnabled: r.riskAlertEnabled,
    riskMeal: r.riskMeal,
    riskWeight: r.riskWeight,
    riskWeightGoal: r.riskWeightGoal,
    themeColor: '#059669',
    defaultGoals: { kcal: 2000, P: 100, F: 56, C: 275 },
  };
}

type RiskFlags = { meal: boolean; weight: boolean; weightGoal: boolean };

function riskLabel(row: CustomerRiskRow, flags: RiskFlags): string {
  const labels: string[] = [];

  if (flags.meal) {
    const d = row.daysSinceLastRecord;
    if (d === null || d >= 1) {
      if (d === 1) labels.push('記録漏れ');
      else if (d === 2) labels.push('記録漏れ2日');
      else labels.push('記録漏れ2日以上');
    }
  }

  if (flags.weight) {
    const w = row.daysSinceLastWeight;
    if (w === null || w >= 1) {
      if (w === 1) labels.push('体重記載漏れ');
      else if (w === 2) labels.push('体重記載漏れ2日');
      else labels.push('体重記載漏れ2日以上');
    }
  }

  if (flags.weightGoal && row.weightStalled) labels.push('体重停滞');

  return labels.join('、');
}

function isAtRisk(row: CustomerRiskRow, flags: RiskFlags): boolean {
  if (flags.meal && (row.daysSinceLastRecord === null || row.daysSinceLastRecord >= 1)) return true;
  if (flags.weight && (row.daysSinceLastWeight === null || row.daysSinceLastWeight >= 1)) return true;
  if (flags.weightGoal && row.weightStalled) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  const now = jstNow();
  const todayDate = fmtDate(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = fmtDate(yesterday);

  // ---- リスクお知らせ処理（レポート設定と独立して毎日実行）----
  const riskAlertResults: Array<{
    tenantId: string;
    status: 'sent' | 'skipped' | 'disabled' | 'no_at_risk' | 'already_sent' | 'error';
    atRiskCount?: number;
    error?: string;
  }> = [];

  if (isAnnouncementsConfigured()) {
    try {
      const allTenantRowsForRisk = await listTenantRows(FITMEAL_TENANTS_DB_ID);
      // dedupe 用: 今日すでに送信済みのお知らせを全取得
      const existingAnnouncements = await listAllAnnouncementsAdmin();
      const sentTodayTenants = new Set<string>(
        existingAnnouncements
          .filter((a) => {
            if (a.audience !== '店舗向け') return false;
            if (!a.title.startsWith('【本日の要注意顧客')) return false;
            // createdAt は Notion created_time = UTC。JST 日付の todayDate と直接
            // 比較すると 0–9時JST のあいだ前日扱いになり（cron は 21:00UTC=6:00JST）
            // 当日分を取りこぼして毎回重複作成してしまう。作成時に JST 日付で書き込む
            // publishedAt（公開日）で当日判定する（タイムゾーン変換不要・完全一致）。
            return a.publishedAt === todayDate;
          })
          .flatMap((a) => a.targetTenants)
      );

      for (const tenantRow of allTenantRowsForRisk) {
        if (!tenantRow.tenantId || tenantRow.status === '解約') continue;
        const riskFlags: RiskFlags = {
          meal: !!tenantRow.riskMeal,
          weight: !!tenantRow.riskWeight,
          weightGoal: !!tenantRow.riskWeightGoal,
        };
        if (!riskFlags.meal && !riskFlags.weight && !riskFlags.weightGoal) {
          riskAlertResults.push({ tenantId: tenantRow.tenantId, status: 'disabled' });
          continue;
        }
        if (!tenantRow.customerDbId || !tenantRow.foodDbId) {
          riskAlertResults.push({ tenantId: tenantRow.tenantId, status: 'error', error: '顧客DB/食事DBが未設定' });
          continue;
        }
        if (sentTodayTenants.has(tenantRow.tenantId)) {
          riskAlertResults.push({ tenantId: tenantRow.tenantId, status: 'already_sent' });
          continue;
        }

        const tenantConfig = tenantToConfig(tenantRow);
        try {
          await runInTenantContext(tenantConfig, () => computeAndStoreTenantRisk());

          const risks = await listCustomerRiskByTenant(tenantRow.tenantId, CURRENT_ENV);
          const atRisk = risks.filter((r) => isAtRisk(r, riskFlags));

          if (atRisk.length === 0) {
            riskAlertResults.push({ tenantId: tenantRow.tenantId, status: 'no_at_risk', atRiskCount: 0 });
            continue;
          }

          const lines = atRisk.map((r) => `・${r.name ?? '(名前なし)'}: ${riskLabel(r, riskFlags)}`).join('\n');
          const body = `${lines}\n\n進捗管理で詳細を確認できます。`;

          await createAnnouncement({
            title: `【本日の要注意顧客 ${atRisk.length}名】`,
            body,
            audience: '店舗向け',
            importance: '重要',
            pinned: false,
            targetTenants: [tenantRow.tenantId],
            publishedAt: todayDate,
          });

          riskAlertResults.push({ tenantId: tenantRow.tenantId, status: 'sent', atRiskCount: atRisk.length });
        } catch (e) {
          riskAlertResults.push({
            tenantId: tenantRow.tenantId,
            status: 'error',
            error: e instanceof Error ? e.message : 'unknown',
          });
        }
      }
    } catch (e) {
      console.error('[cron/daily-reports] riskAlert processing failed', e);
    }
  }
  // ---- リスクお知らせ処理ここまで ----

  if (!isScheduledReportsConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: 'SCHEDULED_REPORTS_DB_ID 未設定',
      executedAt: now.toISOString(),
      riskAlertResults,
    });
  }

  const allRules = await listAllRules();
  const firingRules = allRules.filter((r) => r.enabled && shouldFire(r, now));

  if (firingRules.length === 0) {
    return NextResponse.json({
      ok: true,
      executedAt: now.toISOString(),
      elapsedMs: Date.now() - startedAt,
      jstHour: now.getHours(),
      firingRules: 0,
      results: [],
      riskAlertResults,
    });
  }

  const allTenantRows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenantRowMap = new Map(allTenantRows.map((r) => [r.tenantId, r]));

  const results: Array<{
    ruleId: string;
    ruleName: string;
    tenantId: string;
    customers: number;
    sent: number;
    failed: number;
    errors: string[];
  }> = [];

  for (const rule of firingRules) {
    const tenantRow = tenantRowMap.get(rule.tenantId);
    if (!tenantRow) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        tenantId: rule.tenantId,
        customers: 0,
        sent: 0,
        failed: 0,
        errors: [`テナント ${rule.tenantId} が見つかりません`],
      });
      continue;
    }
    if (tenantRow.status === '解約') {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        tenantId: rule.tenantId,
        customers: 0,
        sent: 0,
        failed: 0,
        errors: ['テナントは解約済みです'],
      });
      continue;
    }
    if (!tenantRow.customerDbId || !tenantRow.foodDbId) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        tenantId: rule.tenantId,
        customers: 0,
        sent: 0,
        failed: 0,
        errors: ['顧客DB/食事DBが未設定です'],
      });
      continue;
    }

    if (rule.sendLine && !tenantRow.lineChannelToken) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        tenantId: rule.tenantId,
        customers: 0,
        sent: 0,
        failed: 0,
        errors: ['LINE送信=ON だが lineChannelToken 未設定のためスキップ'],
      });
      continue;
    }

    const tenantConfig = tenantToConfig(tenantRow);

    const allCustomers = await runInTenantContext(tenantConfig, () => listAllCustomers());
    let activeCustomers = allCustomers.filter(
      (c) => c.foodStatus === '進行中' && c.lineUserId
    );

    if (rule.audience === '店舗' && rule.targetStoreId) {
      activeCustomers = activeCustomers.filter((c) => c.storeId === rule.targetStoreId);
    }

    const templates = await runInTenantContext(tenantConfig, () => listTemplates());
    const resolvedTemplate =
      templates.find((t) => t.name === rule.templateName) ||
      templates.find((t) => t.category === rule.templateName) ||
      null;

    if (!resolvedTemplate) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        tenantId: rule.tenantId,
        customers: activeCustomers.length,
        sent: 0,
        failed: 0,
        errors: [`テンプレ「${rule.templateName}」が見つかりません`],
      });
      continue;
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    await runInTenantContext(tenantConfig, async () => {
      for (const customer of activeCustomers) {
        try {
          const { startDate: reportStart, endDate: reportEnd } = resolveDateRange(
            resolvedTemplate.rangeType,
            { startDate: yesterdayDate, endDate: yesterdayDate }
          );
          const records = await listRecordsInRange(customer.lineUserId, reportStart, reportEnd);
          const store = customer.storeId
            ? await getStoreByStoreId(customer.storeId).catch(() => null)
            : null;

          // 期間内の「開始体重・最終体重」（週次/月次の増減表記に使用）
          const { first: firstWeight, last: lastWeight } = customer.foodSheetPageId
            ? await getWeightBoundsInRange(customer.foodSheetPageId, reportStart, reportEnd).catch(
                () => ({ first: null, last: null })
              )
            : { first: null, last: null };
          const effectiveWeight = lastWeight ?? customer.currentWeight;

          const isSingleDay = reportStart === reportEnd;
          const vars = buildReportVariables(records, customer, store, {
            startDate: reportStart,
            endDate: reportEnd,
            isSingleDay,
          }, lastWeight, firstWeight);
          const sum = {
            kcal: Number(vars.kcal),
            P: Number(vars.P),
            F: Number(vars.F),
            C: Number(vars.C),
          };

          const mealItems = records
            .map((r) => ({
              mealType: r.mealType,
              name: (r.memo || r.title || '').split(/\s*\/\s*AI識別[:：]/)[0]?.trim().slice(0, 50),
            }))
            .filter((item) => item.name);

          let body = applyVars(resolvedTemplate.bodyTemplate, vars);
          const aiVars = Array.from(
            new Set(Array.from(body.matchAll(/\{(ai_\w+)\}/g), (m) => m[1]))
          );
          if (aiVars.length > 0) {
            try {
              const aiComments = await generateReportComments({
                customerName: customer.name,
                date: reportEnd,
                sum: {
                  kcal: Math.round(sum.kcal),
                  P: Math.round(sum.P * 10) / 10,
                  F: Math.round(sum.F * 10) / 10,
                  C: Math.round(sum.C * 10) / 10,
                },
                goals: customer.goals,
                currentWeight: effectiveWeight,
                targetWeight: customer.targetWeight,
                requiredKeys: aiVars,
                mealItems,
              });
              body = body.replace(/\{(ai_\w+)\}/g, (_, k) => aiComments[k] ?? `{${k}}`);
            } catch (e) {
              errors.push(
                `${customer.name}: AI生成失敗 ${e instanceof Error ? e.message : ''}`
              );
            }
          }

          const title = resolvedTemplate.titleTemplate
            ? applyVars(resolvedTemplate.titleTemplate, vars)
            : `${reportEnd} の振り返り`;

          if (rule.saveInApp) {
            await createNotification({
              lineUserId: customer.lineUserId,
              customerName: customer.name,
              category: resolvedTemplate.category as '前日レポート' | '週次レポート' | 'お知らせ' | 'アドバイス',
              title,
              body,
              staffName: store?.name || '',
            }).catch(() => null);
          }

          if (rule.sendLine) {
            const pushResult = await pushLineMessage(
              customer.lineUserId,
              title,
              body,
              store?.name || '',
              { tokenOverride: tenantRow.lineChannelToken! }
            );
            if (pushResult.pushed) {
              sentCount++;
            } else {
              failedCount++;
              errors.push(`${customer.name}: ${pushResult.reason}`);
            }
          } else {
            sentCount++;
          }
        } catch (e) {
          failedCount++;
          errors.push(`${customer.name}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
    });

    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      tenantId: rule.tenantId,
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
    jstHour: now.getHours(),
    firingRules: firingRules.length,
    results,
    riskAlertResults,
  });
}
