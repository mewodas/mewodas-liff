// PFC キャリブレーション係数 日次更新 Cron
//
// 毎日 JST 03:00 (UTC 18:00) に Vercel Cron が呼び出す。各テナントについて、
// 過去 30 日の食事レコードからトレーナー修正・未修正を集計して推奨係数を算出し、
// Notion テナント DB の「PFC推奨_P/F/C」列に書き戻す。
//
// 集計ロジックは lib/calibration.ts に共通化（/admin/corrections と同じ実装）。
//
// セキュリティ:
//   - Vercel Cron は Authorization: Bearer CRON_SECRET を送る
//   - 手動実行用: ?secret=XXX クエリパラメータでも可

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import {
  listTenantRows,
  getCorrectionRecords,
  updateTenantRow,
  type TenantRow,
} from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import type { TenantConfig } from '@/lib/tenant';
import { runInTenantContext } from '@/lib/tenantContext';
import { computeCalibrationSuggestion } from '@/lib/calibration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOOKBACK_DAYS = 30;

function jstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tenantRowToConfig(r: TenantRow): TenantConfig {
  return {
    id: r.tenantId,
    name: r.name,
    notionApiKey: process.env.NOTION_API_KEY || '',
    notionCustomerDbId: r.customerDbId!,
    notionFoodDbId: r.foodDbId!,
    notionWeightDbId: r.weightDbId ?? undefined,
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
  const toDate = fmtDate(now);
  const fromDateObj = new Date(now);
  fromDateObj.setDate(fromDateObj.getDate() - LOOKBACK_DAYS);
  const fromDate = fmtDate(fromDateObj);

  // 全テナント取得（解約・必須DB ID 未設定は除外）
  const allTenants = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const targets = allTenants.filter((t) => {
    if (t.status === '解約') return false;
    if (!t.customerDbId || !t.foodDbId) return false;
    return true;
  });

  type Result = {
    tenantId: string;
    tenantName: string;
    updated: boolean;
    suggestion?: { P: number; F: number; C: number };
    sampleSize: number;
    trainerCorrectedCount: number;
    uncorrectedCount: number;
    skipReason?: string;
    error?: string;
  };
  const results: Result[] = [];

  for (const t of targets) {
    const tenantConfig = tenantRowToConfig(t);
    try {
      const records = await runInTenantContext(tenantConfig, () =>
        getCorrectionRecords(fromDate, toDate)
      );
      const calib = computeCalibrationSuggestion(records);

      if (calib.updated) {
        // Notion テナント行の PFC推奨_P/F/C を更新
        await updateTenantRow(t.pageId, {
          pfcRecommendedP: calib.suggestion.P,
          pfcRecommendedF: calib.suggestion.F,
          pfcRecommendedC: calib.suggestion.C,
        });
        // eslint-disable-next-line no-console
        console.log(
          `[update-calibrations] ${t.tenantId} (${t.name}): updated P=${calib.suggestion.P} F=${calib.suggestion.F} C=${calib.suggestion.C} (samples=${calib.sampleSize}, trainer=${calib.trainerCorrectedCount}, uncorrected=${calib.uncorrectedCount})`
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[update-calibrations] ${t.tenantId} (${t.name}): skipped — ${calib.skipReason}`
        );
      }

      results.push({
        tenantId: t.tenantId,
        tenantName: t.name,
        updated: calib.updated,
        suggestion: calib.updated ? calib.suggestion : undefined,
        sampleSize: calib.sampleSize,
        trainerCorrectedCount: calib.trainerCorrectedCount,
        uncorrectedCount: calib.uncorrectedCount,
        skipReason: calib.skipReason,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown error';
      // eslint-disable-next-line no-console
      console.error(`[update-calibrations] ${t.tenantId} (${t.name}): ERROR ${message}`);
      results.push({
        tenantId: t.tenantId,
        tenantName: t.name,
        updated: false,
        sampleSize: 0,
        trainerCorrectedCount: 0,
        uncorrectedCount: 0,
        error: message,
      });
    }
  }

  const updatedCount = results.filter((r) => r.updated).length;
  const skippedCount = results.filter((r) => !r.updated && !r.error).length;
  const errorCount = results.filter((r) => !!r.error).length;

  return NextResponse.json({
    ok: true,
    executedAt: now.toISOString(),
    elapsedMs: Date.now() - startedAt,
    period: { from: fromDate, to: toDate, days: LOOKBACK_DAYS },
    processed: results.length,
    updated: updatedCount,
    skipped: skippedCount,
    errors: errorCount,
    results,
  });
}
