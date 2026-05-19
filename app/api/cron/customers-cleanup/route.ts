// 設定中顧客の自動クリーンアップ Cron
//
// 毎日 03:00 (JST) に Vercel Cron が呼び出す。
// 全テナントを横断し、foodStatus='設定中' かつ lineUserId なし かつ
// createdTime が 14 日以上前の顧客を Notion アーカイブ化する。
//
// 仕様根拠: 招待リンクを送付しないまま放置された設定中顧客が DB に
// 蓄積するリスクへの対策。設定中では LIFF 利用不可なので、
// 14 日経過時点で実質的に未着手と判断して自動削除する。
//
// セキュリティ:
//   - Vercel Cron は CRON_SECRET ヘッダーをチェック（Authorization: Bearer xxx）
//   - 手動でも呼び出せるよう、env CRON_SECRET と一致すれば許可

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import { listTenantRows, listAllCustomers, archiveCustomer } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import type { TenantConfig } from '@/lib/tenant';
import { runInTenantContext } from '@/lib/tenantContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const STALE_DAYS = 14;

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
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

  const allTenants = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const targets = allTenants.filter(
    (t) => t.status !== '解約' && t.customerDbId
  );

  const results: Array<{
    tenantId: string;
    tenantName: string;
    deleted: number;
    error?: string;
  }> = [];

  for (const t of targets) {
    const config = tenantToConfig(t);
    try {
      const deleted = await runInTenantContext(config, async () => {
        const customers = await listAllCustomers();
        const stale = customers.filter(
          (c) =>
            c.foodStatus === '設定中' &&
            !c.lineUserId &&
            c.createdTime !== null &&
            new Date(c.createdTime).getTime() < cutoff
        );
        for (const c of stale) {
          await archiveCustomer(c.pageId);
        }
        return stale.length;
      });
      results.push({ tenantId: t.tenantId, tenantName: t.name, deleted });
    } catch (e) {
      results.push({
        tenantId: t.tenantId,
        tenantName: t.name,
        deleted: 0,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  return NextResponse.json({
    ok: true,
    totalDeleted,
    elapsedMs: Date.now() - startedAt,
    results,
  });
}
