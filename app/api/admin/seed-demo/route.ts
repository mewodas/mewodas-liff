// DEMO_FITMEAL_SAMPLE 顧客を本番 mewodas テナントにシードする一時エンドポイント。
// 使用後（シード完了確認後）に削除すること。
// CRON_SECRET Bearer 認証（一回限りのシード操作用）。

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cronAuth';
import { FITMEAL_TENANTS_PARENT_PAGE_ID } from '@/lib/tenant';
import { refreshDemoDataForTenant } from '@/lib/refreshDemoData';

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

export async function POST(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const notionApiKey = process.env.NOTION_API_KEY || '';
  if (!notionApiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY 未設定' }, { status: 500 });
  }

  const DEMO_LINE_USER_ID = 'DEMO_FITMEAL_SAMPLE';

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
  const refreshResult = await refreshDemoDataForTenant(
    'mewodas',
    { customerDbId, foodDbId, weightDbId },
    notionApiKey,
    parentPageId
  );

  // 最終確認
  const finalCheck = await notionReq(notionApiKey, 'POST', `/databases/${customerDbId}/query`, {
    filter: { property: 'LINEユーザーID', rich_text: { equals: DEMO_LINE_USER_ID } },
    page_size: 5,
  });

  return NextResponse.json({
    ok: true,
    mode,
    customerPageId,
    lineUserId: DEMO_LINE_USER_ID,
    tenantId: 'mewodas',
    refreshResult,
    finalCheckCount: (finalCheck.results || []).length,
  });
}
