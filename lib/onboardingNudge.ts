// オンボーディング未完了の催促
//
// 登録（契約開始日）から一定日数たっても LINE 連携が完了していない店舗に、
// セットアップ完了を促すメールを送る。連携が終わらないと顧客が登録できず
// 「公開したつもりで使われない」サイレント失敗になるため（導線監査 Rank3）。
// 日次 cron（daily-reports）から1日1回呼ばれる前提。startDate からの経過日数が
// 1 / 3 / 7 日 になった当日だけ送られ、状態の永続化は不要。7日でナッジ終了。

import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { sendEmail, onboardingNudgeEmail } from '@/lib/email';
import { todayYmdJst, daysBetweenYmd } from '@/lib/dateDays';

export type OnboardingNudgeResult = {
  tenantId: string;
  status: 'sent' | 'skipped' | 'error';
  daysSinceStart?: number;
  reason?: string;
  error?: string;
};

// 催促を送る「登録からの経過日数」。
const NUDGE_DAYS = new Set([1, 3, 7]);

export async function runOnboardingNudges(): Promise<OnboardingNudgeResult[]> {
  const results: OnboardingNudgeResult[] = [];
  let rows;
  try {
    rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  } catch (e) {
    return [{ tenantId: '*', status: 'error', error: e instanceof Error ? e.message : 'listTenantRows failed' }];
  }

  const today = todayYmdJst();

  for (const r of rows) {
    if (!r.tenantId || r.status === '解約') continue;
    if (r.onboardingCompletedAt) continue; // 連携完了済みは対象外
    if (!r.ownerEmail || !r.startDate) continue;

    const daysSinceStart = daysBetweenYmd(r.startDate, today);
    if (daysSinceStart === null || !NUDGE_DAYS.has(daysSinceStart)) continue;

    try {
      const res = await sendEmail(onboardingNudgeEmail({ tenantName: r.name, ownerEmail: r.ownerEmail }));
      results.push({
        tenantId: r.tenantId,
        status: res.sent ? 'sent' : 'skipped',
        daysSinceStart,
        reason: res.sent ? undefined : 'reason' in res ? res.reason : undefined,
      });
    } catch (e) {
      results.push({ tenantId: r.tenantId, status: 'error', daysSinceStart, error: e instanceof Error ? e.message : 'send failed' });
    }
  }

  return results;
}
