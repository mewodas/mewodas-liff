// テナント自動プロビジョニング共有関数。
//
// 用途:
//   1) /api/admin/tenants POST: マスタが手動でテナント作成 (billingMode: '手動' / '無制限')
//   2) /api/stripe/webhook checkout.session.completed: セルフサーブ申込から自動発行 (billingMode: 'Stripe連動')
//
// 冪等性:
//   - stripeCustomerId が既存テナントに紐づいていれば再実行をスキップし、既存テナントを返す。
//   - Stripe webhook の二重発火 / リトライに耐えるための保険。

import {
  listTenantRows,
  createTenantCustomerDb,
  createTenantFoodDb,
  createTenantWeightDb,
  createTenantBodyCompDb,
  insertTenantRow,
  updateTenantRow,
  setTenantPasswordHash,
} from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, FITMEAL_TENANTS_PARENT_PAGE_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { createStore } from '@/lib/stores';
import { hashPassword } from '@/lib/adminAuth';
import { generatePassword } from '@/lib/passwordGen';
import { sendEmail, loginInfoEmail, welcomeEmail } from '@/lib/email';
import { notifySlack } from '@/lib/slack';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

async function notionRequest(
  method: string,
  apiKey: string,
  path: string,
  payload: object
): Promise<any> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function notionPost(apiKey: string, path: string, payload: object): Promise<any> {
  return notionRequest('POST', apiKey, path, payload);
}

function notionPatch(apiKey: string, path: string, payload: object): Promise<any> {
  return notionRequest('PATCH', apiKey, path, payload);
}

export const SAMPLE_LINE_USER_ID = 'SAMPLE_FITMEAL';

function jstDateOffset(daysAgo: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SeedDbIds = { customerDbId: string; foodDbId: string; weightDbId: string; bodyCompDbId: string };

async function getSampleCustomerInfo(
  apiKey: string,
  customerDbId: string
): Promise<{ pageId: string; hasFoodSheetLink: boolean } | null> {
  const res = await notionPost(apiKey, `/databases/${customerDbId}/query`, {
    filter: { property: 'LINEユーザーID', rich_text: { starts_with: 'SAMPLE_' } },
    page_size: 1,
  });
  const page = (res.results || [])[0];
  if (!page) return null;
  const url = page.properties?.['食事記録リンク']?.url;
  return { pageId: page.id as string, hasFoodSheetLink: !!url };
}

function isoToJpMdSeed(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日`;
}

async function createFoodSheetPage(
  apiKey: string,
  parentPageId: string
): Promise<string> {
  const weights = [58.0, 57.8, 57.9, 57.6, 57.5, 57.7, 57.4, 57.3, 57.5, 57.2];
  const exercisePattern = [true, false, true, true, false, true, false, true, true, false];
  const exerciseContents = [
    'ランニング30分',
    '',
    '筋トレ 上半身',
    'ウォーキング40分',
    '',
    '筋トレ 下半身',
    '',
    'ヨガ30分',
    'ランニング25分',
    '',
  ];

  const tableRows = [];
  // ヘッダー行
  tableRows.push({
    type: 'table_row',
    table_row: {
      cells: [
        [{ type: 'text', text: { content: '日付' } }],
        [{ type: 'text', text: { content: '体重(kg)' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '運動' } }],
        [{ type: 'text', text: { content: '運動内容' } }],
      ],
    },
  });
  // データ行 (直近10日: 9日前〜0日前)
  for (let i = 0; i < 10; i++) {
    const daysAgo = 9 - i;
    const dateStr = jstDateOffset(daysAgo);
    const label = isoToJpMdSeed(dateStr);
    const exercised = exercisePattern[i];
    tableRows.push({
      type: 'table_row',
      table_row: {
        cells: [
          [{ type: 'text', text: { content: label } }],
          [{ type: 'text', text: { content: String(weights[i]) } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: exercised ? '✅' : '' } }],
          [{ type: 'text', text: { content: exercised ? exerciseContents[i] : '' } }],
        ],
      },
    });
  }

  const page = await notionPost(apiKey, '/pages', {
    parent: { type: 'page_id', page_id: parentPageId },
    properties: {
      title: [{ type: 'text', text: { content: '山田 花子 個人シート（サンプル）' } }],
    },
    children: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '📝 記録' } }],
        },
      },
      {
        type: 'table',
        table: {
          table_width: 11,
          has_column_header: true,
          has_row_header: false,
          children: tableRows,
        },
      },
    ],
  });
  return page.id as string;
}

export async function seedSampleCustomer(
  tenantId: string,
  dbIds: SeedDbIds,
  notionApiKey: string,
  parentPageId?: string
): Promise<void> {
  const existing = await getSampleCustomerInfo(notionApiKey, dbIds.customerDbId);

  // 既存顧客あり + 食事記録リンク設定済み → 完全スキップ
  if (existing?.hasFoodSheetLink) return;

  const effectiveParentPageId =
    parentPageId ||
    process.env.FITMEAL_TENANTS_PARENT_PAGE_ID ||
    '34ea47a8738d8155a2b1e9f4607e8986';

  let customerPageId: string;

  if (existing) {
    // バックフィル: 顧客は既存、個人シートのみ作成してリンク
    customerPageId = existing.pageId;
  } else {
    // 新規作成
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const isoNow = now.toISOString();

    const newCustomerPage = await notionPost(notionApiKey, '/pages', {
      parent: { database_id: dbIds.customerDbId },
      properties: {
        氏名: { title: [{ text: { content: '山田 花子' } }] },
        LINEユーザーID: { rich_text: [{ text: { content: SAMPLE_LINE_USER_ID } }] },
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
    customerPageId = newCustomerPage.id as string;

    // 食事記録シード（直近7日）
    type MealEntry = { type: string; kcal: number; P: number; F: number; C: number; memo: string };
    const mealsPerDay: MealEntry[][] = [
      [
        { type: '朝食', kcal: 320, P: 18, F: 8, C: 42, memo: '納豆ご飯・味噌汁・ゆで卵' },
        { type: '昼食', kcal: 540, P: 32, F: 14, C: 68, memo: '鶏むね肉と野菜の炒め定食・ご飯150g' },
        { type: '夕食', kcal: 480, P: 28, F: 12, C: 58, memo: '豆腐の煮物・サーモン塩焼き・ほうれん草おひたし' },
        { type: '間食', kcal: 160, P: 8, F: 3, C: 24, memo: 'ヨーグルト・バナナ半分' },
      ],
      [
        { type: '朝食', kcal: 280, P: 14, F: 6, C: 38, memo: 'オートミール・プロテインドリンク' },
        { type: '昼食', kcal: 510, P: 29, F: 13, C: 62, memo: 'サバの味噌煮定食・ご飯130g・サラダ' },
        { type: '夕食', kcal: 550, P: 35, F: 16, C: 60, memo: '鶏胸肉グリル・ブロッコリー・スープ' },
      ],
      [
        { type: '朝食', kcal: 350, P: 20, F: 9, C: 44, memo: '卵かけご飯・わかめ味噌汁・海苔' },
        { type: '昼食', kcal: 490, P: 26, F: 12, C: 64, memo: 'ざるそば・鶏サラダ・温泉卵' },
        { type: '夕食', kcal: 520, P: 30, F: 14, C: 56, memo: 'マグロ刺身・冷奴・野菜スープ・ご飯100g' },
        { type: '間食', kcal: 130, P: 6, F: 2, C: 22, memo: 'りんご・チーズ1枚' },
      ],
      [
        { type: '朝食', kcal: 310, P: 16, F: 7, C: 40, memo: 'ご飯・焼き鮭・ほうれん草炒め' },
        { type: '昼食', kcal: 530, P: 31, F: 15, C: 60, memo: 'カレーライス（中辛）・野菜サラダ' },
        { type: '夕食', kcal: 470, P: 28, F: 11, C: 55, memo: '蒸し鶏・もずく酢・豆腐みそ汁' },
      ],
      [
        { type: '朝食', kcal: 340, P: 19, F: 8, C: 42, memo: 'オムレツ・全粒パン・野菜スープ' },
        { type: '昼食', kcal: 560, P: 33, F: 16, C: 62, memo: '牛しゃぶサラダ定食・雑穀ご飯150g' },
        { type: '夕食', kcal: 460, P: 27, F: 10, C: 54, memo: '豚ヒレ肉ソテー・キャベツ千切り・きのこスープ' },
        { type: '間食', kcal: 140, P: 7, F: 3, C: 20, memo: 'プロテインバー' },
      ],
      [
        { type: '朝食', kcal: 300, P: 15, F: 7, C: 38, memo: 'ご飯・海苔・みそ汁・目玉焼き' },
        { type: '昼食', kcal: 500, P: 28, F: 13, C: 58, memo: '冷しゃぶうどん・温泉卵・ゆでほうれん草' },
        { type: '夕食', kcal: 530, P: 32, F: 14, C: 60, memo: '鶏鍋（豆腐・野菜たっぷり）・ご飯100g' },
      ],
      [
        { type: '朝食', kcal: 360, P: 22, F: 9, C: 44, memo: 'ギリシャヨーグルト・グラノーラ・いちご' },
        { type: '昼食', kcal: 480, P: 25, F: 12, C: 58, memo: 'おにぎり2個・鶏むね唐揚げ・サラダ' },
        { type: '夕食', kcal: 500, P: 30, F: 13, C: 56, memo: 'アジの塩焼き・ひじき煮・ご飯120g・味噌汁' },
        { type: '間食', kcal: 150, P: 8, F: 4, C: 20, memo: 'ミックスナッツ・プロテインドリンク' },
      ],
    ];

    const foodPromises: Promise<unknown>[] = [];
    for (let day = 0; day < 7; day++) {
      const dateStr = jstDateOffset(6 - day);
      const meals = mealsPerDay[day] || mealsPerDay[0];
      for (const meal of meals) {
        foodPromises.push(
          notionPost(notionApiKey, '/pages', {
            parent: { database_id: dbIds.foodDbId },
            properties: {
              食事メモ: { title: [{ text: { content: `${meal.type} (サンプル)` } }] },
              LINE_UserID: { rich_text: [{ text: { content: SAMPLE_LINE_USER_ID } }] },
              日付: { date: { start: dateStr } },
              食事区分: { select: { name: meal.type } },
              カロリー_kcal: { number: meal.kcal },
              タンパク質_g: { number: meal.P },
              脂質_g: { number: meal.F },
              炭水化物_g: { number: meal.C },
              食材メモ: { rich_text: [{ text: { content: meal.memo } }] },
            },
          }).catch(() => null)
        );
      }
    }

    // 体重ログシード（直近9日）
    const dbWeights = [58.0, 57.8, 57.9, 57.6, 57.5, 57.7, 57.4, 57.3, 57.5];
    const weightPromises: Promise<unknown>[] = [];
    for (let day = 0; day < 9; day++) {
      const dateStr = jstDateOffset(8 - day);
      weightPromises.push(
        notionPost(notionApiKey, '/pages', {
          parent: { database_id: dbIds.weightDbId },
          properties: {
            日付: { title: [{ text: { content: dateStr } }] },
            '体重(kg)': { number: dbWeights[day] },
            LINEユーザーID: { rich_text: [{ text: { content: SAMPLE_LINE_USER_ID } }] },
            顧客名: { rich_text: [{ text: { content: '山田 花子' } }] },
            入力経路: { select: { name: 'LIFF' } },
          },
        }).catch(() => null)
      );
    }

    await Promise.all([...foodPromises, ...weightPromises]);
  }

  // 個人シート作成 + 食事記録リンクをセット
  const sheetPageId = await createFoodSheetPage(notionApiKey, effectiveParentPageId);
  const sheetUrl = `https://www.notion.so/${sheetPageId.replace(/-/g, '')}`;
  await notionPatch(notionApiKey, `/pages/${customerPageId}`, {
    properties: {
      食事記録リンク: { url: sheetUrl },
    },
  });
  void tenantId;
}

export type ProvisionInput = {
  name: string;
  ownerEmail: string;
  plan: string; // プラン表示名 ('標準プラン' 等)
  note?: string;
  // 課金モード: 'Stripe連動' = セルフサーブ申込経由、'手動' = admin 手動作成 (既定)
  billingMode?: '無制限' | '手動' | 'Stripe連動';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndDate?: string | null;
  // ウェルカムメールの文面切替 (true: セルフサーブ、false: 既存 admin 経由)
  selfServe?: boolean;
};

export type ProvisionResult = {
  tenantId: string;
  tenantPageId: string;
  customerDbId: string;
  foodDbId: string;
  weightDbId: string;
  bodyCompDbId: string;
  defaultStoreId: string | null;
  // 平文初期PW (mail 送信失敗時にのみマスタへ返却)。mail.sent === true の時は undefined。
  initialPassword?: string;
  mail: { sent: boolean; reason?: string; error?: string };
  // 既存テナント再利用 (冪等)
  reused: boolean;
};

function genTenantId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 8) || 'gym';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug}_${rand}`;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

/**
 * テナント自動プロビジョニング。
 * - Notion 3DB（顧客・食事・体重）作成
 * - テナント行作成
 * - billingMode / Stripe IDs 更新
 * - 初期PW生成 + scrypt ハッシュ保存
 * - デフォルト店舗作成
 * - ウェルカム/ログイン情報メール送信
 *
 * 冪等性: 同じ stripeCustomerId のテナントが既にあれば再利用して即 return。
 *
 * 既知の制約 (Postgres 移行で根本対処予定): 3DB 並列作成 Promise.all が成功した直後で
 * insertTenantRow が失敗した場合、Notion 側に「孤立 DB が残った状態」になる。次の
 * webhook リトライでは stripeCustomerId 付きテナント行がまだ無いため、新規プロビと
 * 判定され、もう一組の 3DB が作られる。実害は孤立 DB 3 本のみ（手動アーカイブで掃除可）。
 * Notion API 失敗率が低い現状では許容、テナント 200 突破で Postgres 移行と同時に解消。
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  // 冪等性チェック: 既存 stripeCustomer に紐づくテナントがあれば再利用
  if (input.stripeCustomerId) {
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const existing = rows.find((r) => r.stripeCustomerId === input.stripeCustomerId);
    if (existing) {
      return {
        tenantId: existing.tenantId,
        tenantPageId: existing.pageId,
        customerDbId: existing.customerDbId || '',
        foodDbId: existing.foodDbId || '',
        weightDbId: existing.weightDbId || '',
        bodyCompDbId: existing.bodyCompDbId || '',
        defaultStoreId: null,
        mail: { sent: false, reason: 'reused' },
        reused: true,
      };
    }
  }

  const tenantId = genTenantId(input.name);

  // Notion 4DB を並列作成
  const [customerDbId, foodDbId, weightDbId, bodyCompDbId] = await Promise.all([
    createTenantCustomerDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
    createTenantFoodDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
    createTenantWeightDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
    createTenantBodyCompDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
  ]);

  // テナント行作成 (基本フィールドのみ)
  const tenantPageId = await insertTenantRow(FITMEAL_TENANTS_DB_ID, {
    name: input.name,
    tenantId,
    plan: input.plan,
    customerDbId,
    foodDbId,
    weightDbId,
    bodyCompDbId,
    ownerEmail: input.ownerEmail,
    startDate: jstToday(),
    note: input.note || '',
  });

  // billingMode / Stripe IDs を後追い更新 (insertTenantRow の signature 拡張を避けるため)
  if (
    input.billingMode !== undefined ||
    input.stripeCustomerId !== undefined ||
    input.stripeSubscriptionId !== undefined
  ) {
    await updateTenantRow(tenantPageId, {
      billingMode: input.billingMode,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
    });
  }

  // デフォルト店舗
  let defaultStoreId: string | null = null;
  try {
    const store = await createStore({
      name: input.name,
      storeId: 'main',
      tenantId,
      manager: input.ownerEmail.split('@')[0],
      signature: `${input.name} 担当`,
    });
    defaultStoreId = store.pageId;
  } catch {
    // 店舗作成失敗してもテナント作成は成功扱い
  }

  // 初期PW + メール送信
  const initialPassword = generatePassword(12);
  let mail: ProvisionResult['mail'] = { sent: false };
  try {
    const hash = hashPassword(initialPassword);
    await setTenantPasswordHash(tenantPageId, hash);

    // セルフサーブはウェルカムメール、admin 経由はログイン情報メール
    const payload = input.selfServe
      ? welcomeEmail({
          tenantName: input.name,
          ownerEmail: input.ownerEmail,
          password: initialPassword,
          trialEndDate: input.trialEndDate || undefined,
        })
      : loginInfoEmail({
          tenantName: input.name,
          ownerEmail: input.ownerEmail,
          password: initialPassword,
        });

    const result = await sendEmail(payload);
    if (result.sent) {
      mail = { sent: true };
    } else if (result.reason === 'no_provider') {
      mail = { sent: false, reason: 'no_provider' };
    } else {
      mail = { sent: false, reason: 'error', error: result.error };
    }
  } catch (e) {
    mail = { sent: false, reason: 'error', error: e instanceof Error ? e.message : 'unknown' };
  }

  // ウェルカム/ログイン情報メールが送れなかった場合、運営に通知。
  // オーナーは初期パスワードを受け取れていないので、/admin/tenants から再発行して
  // 手動で渡す必要がある（フォールバック導線・導線監査 Rank4）。
  if (!mail.sent) {
    await notifySlack(
      `⚠️ FitMeal 新規テナント「${input.name}」(${tenantId}) の${input.selfServe ? 'ウェルカム' : 'ログイン情報'}メール送信に失敗しました（${mail.reason ?? 'error'}${mail.error ? ': ' + mail.error : ''}）。/admin/tenants から初期パスワードを再発行し、オーナー（${input.ownerEmail}）へ手動でお渡しください。`
    );
  }

  invalidateTenantCache();

  // サンプル顧客シード（best-effort: 失敗してもテナント作成は成功扱い）
  const notionApiKey = process.env.NOTION_API_KEY || '';
  if (notionApiKey && customerDbId && foodDbId && weightDbId) {
    seedSampleCustomer(tenantId, { customerDbId, foodDbId, weightDbId, bodyCompDbId }, notionApiKey).catch((e) => {
      console.error('[provisionTenant] seedSampleCustomer failed (non-critical):', e);
    });
  }

  return {
    tenantId,
    tenantPageId,
    customerDbId,
    foodDbId,
    weightDbId,
    bodyCompDbId,
    defaultStoreId,
    initialPassword: mail.sent ? undefined : initialPassword,
    mail,
    reused: false,
  };
}
