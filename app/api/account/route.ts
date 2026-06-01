import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import {
  getCustomerByLineId,
  archiveCustomer,
  getFoodRecordsByDateRange,
  deleteFoodRecord,
} from '@/lib/notion';
import { listWeightLogsByLineUser, deleteWeightLog } from '@/lib/repository/weightLogs';
import { listBodyCompositionLogsByLineUser, deleteBodyCompositionLog } from '@/lib/repository/bodyComposition';
import { listExerciseLogsByLineUser, deleteExerciseLog } from '@/lib/repository/exerciseLogs';
import { deleteCustomerRiskByLineUser } from '@/lib/repository/customerRisk';
import { withLiffTenant } from '@/lib/withTenant';
import { logAuditEventAsync } from '@/lib/auditLog';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 全期間をカバーする日付レンジ（食事記録は日付フィルタが必要なため）
const ALL_START = '2000-01-01';
const ALL_END = '2100-12-31';

// verifiedLineUserId に厳密スコープして、現テナントの全健康データ（Notion）を削除する。
// 個々の失敗は握りつぶして残りを続行（可能な限り消す）。削除件数を返す。
async function purgeHealthRecords(lineUserId: string): Promise<Record<string, number>> {
  const counts = { food: 0, weight: 0, bodyComposition: 0, exercise: 0, failed: 0 };

  const foods = await getFoodRecordsByDateRange(lineUserId, ALL_START, ALL_END).catch(() => []);
  for (const f of foods) {
    try { await deleteFoodRecord(f.pageId); counts.food++; } catch (e) { counts.failed++; console.error('[account.delete] food', f.pageId, e); }
  }
  const weights = await listWeightLogsByLineUser(lineUserId).catch(() => []);
  for (const w of weights) {
    try { await deleteWeightLog(w.id); counts.weight++; } catch (e) { counts.failed++; console.error('[account.delete] weight', w.id, e); }
  }
  const bodycomps = await listBodyCompositionLogsByLineUser(lineUserId).catch(() => []);
  for (const b of bodycomps) {
    try { await deleteBodyCompositionLog(b.id); counts.bodyComposition++; } catch (e) { counts.failed++; console.error('[account.delete] bodycomp', b.id, e); }
  }
  const exercises = await listExerciseLogsByLineUser(lineUserId).catch(() => []);
  for (const ex of exercises) {
    try { await deleteExerciseLog(ex.id); counts.exercise++; } catch (e) { counts.failed++; console.error('[account.delete] exercise', ex.id, e); }
  }
  return counts;
}

export const DELETE = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId, { force: true });
  if (!customer) return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });

  const tenant = getCurrentTenant();

  // 即時: 顧客アーカイブ（UI 上で即「削除済み」）＋ Neon customer_risk 行の物理削除（Postgres 側 PII 除去）
  await archiveCustomer(customer.pageId);
  await deleteCustomerRiskByLineUser(tenant.id, verifiedLineUserId).catch((e) =>
    console.error('[account.delete] risk', e)
  );

  // 背景: 全健康データ（食事/体重/体組成/運動）を削除し、件数を監査ログに記録。
  // 注: Drive 上の食事/体組成写真は GAS 側に削除手段が無いため未削除（残課題）。
  waitUntil(
    purgeHealthRecords(verifiedLineUserId)
      .then((counts) =>
        // waitUntil の入れ子を避けるため await 版で監査ログを記録（削除件数を確実に残す）
        logAuditEventAsync({
          action: 'account.delete',
          outcome: 'success',
          actorType: 'customer',
          actorId: verifiedLineUserId,
          tenantId: tenant.id,
          targetType: 'customer',
          targetId: customer.pageId,
          metadata: { ...counts, driveImages: 'not_deleted_gas_unsupported' },
        })
      )
      .catch((e) => console.error('[account.delete] purge failed', e))
  );

  return NextResponse.json({ ok: true });
});
