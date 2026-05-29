// DEMO_FITMEAL_SAMPLE 顧客を本番 mewodas テナントにシードする一時エンドポイント。
// 使用後（シード完了確認後）に削除すること。
// master only / withAdminTenant 認証必須。

import { NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { FITMEAL_TENANTS_PARENT_PAGE_ID } from '@/lib/tenant';
import { refreshDemoDataForTenant } from '@/lib/refreshDemoData';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

async function notionReq(apiKey: string, method: string, path: string, payload?: object) {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function jstNow() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return d.toISOString();
}

export const POST = withAdminTenant(async () => {
  const tenant = getCurrentTenant();
  const notionApiKey = process.env.NOTION_API_KEY || '';
  if (!notionApiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY 未設定' }, { status: 500 });
  }

  const DEMO_LINE_USER_ID = 'DEMO_FITMEAL_SAMPLE';

  // テナント DB から mewodas の DB IDs を取得（フォールバックは env/ハードコード）
  const customerDbId =
    process.env.NOTION_CUSTOMER_DB_ID || '2d6ec0c0531b4ef6a4c396baa6807546';
  const foodDbId = process.env.NOTION_FOOD_DB_ID || '8719d5ab23074ea5bf6e77fde352db86';
  const weightDbId = process.env.NOTION_WEIGHT_DB_ID || '';

  if (!weightDbId) {
    return NextResponse.json({ error: 'NOTION_WEIGHT_DB_ID 未設定' }, { status: 500 });
  }

  // 既存 DEMO_FITMEAL_SAMPLE 顧客を確認
  const existing = await notionReq(notionApiKey, 'POST', `/databases/${customerDbId}/query`, {
    filter: { property: 'LINEユーザーID', rich_text: { equals: DEMO_LINE_USER_ID } },
    page_size: 5,
  });

  let customerPageId: string;
  let mode: string;

  if ((existing.results || []).length > 0) {
    customerPageId = existing.results[0].id as string;
    mode = 'existing';
  } else {
    // 新規作成
    const isoNow = jstNow();
    const newPage = await notionReq(notionApiKey, 'POST', '/pages', {
      parent: { database_id: customerDbId },
      properties: {
        氏名: { title: [{ text: { content: '山田 花子' } }] },
        LINEユーザーID: { rich_text: [{ text: { content: DEMO_LINE_USER_ID } }] },
        食事管理ステータス: { select: { name: '進行中' } },
        性別: { select: { name: '女性' } },
        '身長(cm)': { number: 158 },
        年齢: { number: 28 },
        活動レベル: { select: { name: '中等度' } },
        プラン: { select: { name: '減量' } },
        '開始体重(kg)': { number: 58.0 },
        '目標体重(kg)': { number: 52.0 },
        '目標カロリー(kcal)': { number: 1500 },
        '目標P(g)': { number: 90 },
        '目標F(g)': { number: 40 },
        '目標C(g)': { number: 180 },
        オンボーディング完了日時: { date: { start: isoNow } },
        登録完了日時: { date: { start: isoNow } },
      },
    });
    customerPageId = newPage.id as string;
    mode = 'created';
  }

  const parentPageId =
    process.env.FITMEAL_TENANTS_PARENT_PAGE_ID || FITMEAL_TENANTS_PARENT_PAGE_ID;

  // refreshDemoDataForTenant で食事・体重・個人シートを今日基準でシード/リフレッシュ
  // この関数は SAMPLE_ / DEMO_ 両方を対象にするが、ここでは DEMO_FITMEAL_SAMPLE 顧客のみ存在するため1名分のみ処理される
  const refreshResult = await refreshDemoDataForTenant(
    tenant.id,
    { customerDbId, foodDbId, weightDbId },
    notionApiKey,
    parentPageId
  );

  // refreshDemoDataForTenant の結果で customersProcessed が 0 の場合は
  // DEMO_ プレフィックスで顧客が見つかっているはずなので確認
  const finalCheck = await notionReq(notionApiKey, 'POST', `/databases/${customerDbId}/query`, {
    filter: { property: 'LINEユーザーID', rich_text: { equals: DEMO_LINE_USER_ID } },
    page_size: 5,
  });

  return NextResponse.json({
    ok: true,
    mode,
    customerPageId,
    lineUserId: DEMO_LINE_USER_ID,
    tenantId: tenant.id,
    refreshResult,
    finalCheckCount: (finalCheck.results || []).length,
  });
});
