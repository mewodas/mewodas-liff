// 無料トライアル終了前リマインド
//
// 14日トライアルの「終了4日前（=おおむね10日目）」と「前日」に、
// テナントのオーナーへ初回請求予告メールを送る。
// nextBillingDate（=トライアル中は初回請求日）までの残日数で判定する。
// 日次 cron（daily-reports）から1日1回呼ばれる前提なので、残日数が 4 / 1 に
// なった当日だけ送信され、状態の永続化は不要（重複しない）。

import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { sendEmail, trialEndingEmail } from '@/lib/email';

export type TrialReminderResult = {
  tenantId: string;
  status: 'sent' | 'skipped' | 'error';
  daysLeft?: number;
  reason?: string;
  error?: string;
};

// 送信トリガーとなる「残日数」。10日目相当(=終了4日前)と前日。
const REMIND_DAYS = new Set([4, 1]);

function ymdToUtc(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function todayYmdJst(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** from(YYYY-MM-DD) → to(YYYY-MM-DD) の日数差（UTC 0時基準・TZドリフトなし） */
function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtc(fromYmd);
  const b = ymdToUtc(toYmd);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

export async function runTrialReminders(): Promise<TrialReminderResult[]> {
  const results: TrialReminderResult[] = [];
  let rows;
  try {
    rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  } catch (e) {
    return [{ tenantId: '*', status: 'error', error: e instanceof Error ? e.message : 'listTenantRows failed' }];
  }

  const today = todayYmdJst();

  for (const r of rows) {
    if (!r.tenantId || r.status === '解約') continue;
    // Stripe連動（または未設定=後方互換でStripe連動扱い）のみ対象。無制限/手動は除外。
    if (r.billingMode && r.billingMode !== 'Stripe連動') continue;
    if (r.paymentStatus !== 'お試し') continue;
    if (!r.ownerEmail || !r.nextBillingDate) continue;

    const daysLeft = daysBetween(today, r.nextBillingDate);
    if (daysLeft === null || !REMIND_DAYS.has(daysLeft)) continue;

    try {
      const res = await sendEmail(
        trialEndingEmail({
          tenantName: r.name,
          ownerEmail: r.ownerEmail,
          daysLeft,
          chargeDate: r.nextBillingDate,
          monthlyPrice: r.monthlyPrice ?? null,
        })
      );
      results.push({
        tenantId: r.tenantId,
        status: res.sent ? 'sent' : 'skipped',
        daysLeft,
        reason: res.sent ? undefined : 'reason' in res ? res.reason : undefined,
      });
    } catch (e) {
      results.push({ tenantId: r.tenantId, status: 'error', daysLeft, error: e instanceof Error ? e.message : 'send failed' });
    }
  }

  return results;
}
