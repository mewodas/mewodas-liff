import { getCurrentTenant } from './tenant';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

// 現在のテナント設定から Notion DB ID を取得
export function getTenantNotion() {
  const t = getCurrentTenant();
  return {
    foodDbId: t.notionFoodDbId,
    customerDbId: t.notionCustomerDbId,
    apiKey: t.notionApiKey,
    defaultGoals: t.defaultGoals,
  };
}

export type Customer = {
  pageId: string;
  name: string;
  furigana: string | null;
  lineUserId: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  foodSheetPageId: string | null;
  gender: string | null;
  heightCm: number | null;
  age: number | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  activityLevel: string | null;
  plan: string | null;
  storeId: string | null;
  onboardingCompletedAt: string | null;
};

export type NutritionDetailsRecord = {
  fiber: number;
  salt: number;
  iron: number;
  calcium: number;
  vitaminC: number;
};

export type FoodRecord = {
  pageId: string;
  mealType: string;
  date: string;
  recordedAt: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  memo: string;
  imageUrl: string | null;
  title: string;
  details: NutritionDetailsRecord | null;
  lineUserId?: string;
};

async function notionRequest(
  method: string,
  path: string,
  payload?: object
): Promise<any> {
  const apiKey = getTenantNotion().apiKey;
  if (!apiKey) throw new Error('NOTION_API_KEY（テナント設定）未設定');
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
    throw new Error(`Notion API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// 顧客情報のインメモリキャッシュ（同じVercel関数インスタンス内）
// 連続して画面遷移する際の顧客取得を高速化
const customerCache = new Map<string, { customer: Customer; expiry: number }>();
const CUSTOMER_CACHE_TTL_MS = 30 * 60 * 1000; // 30分（顧客情報は頻繁に変わらない）

export async function getCustomerByLineId(
  lineUserId: string
): Promise<Customer | null> {
  const cached = customerCache.get(lineUserId);
  if (cached && Date.now() < cached.expiry) {
    return cached.customer;
  }
  const tenant = getTenantNotion();
  const res = await notionRequest(
    'POST',
    `/databases/${tenant.customerDbId}/query`,
    {
      filter: {
        property: 'LINEユーザーID',
        rich_text: { equals: lineUserId },
      },
    }
  );
  if (!res.results || res.results.length === 0) return null;
  const page = res.results[0];
  const p = page.properties;
  const customer: Customer = {
    pageId: page.id,
    name: p['氏名']?.title?.[0]?.plain_text || '不明',
    furigana: p['フリガナ']?.rich_text?.[0]?.plain_text ?? null,
    lineUserId,
    foodStatus: p['食事管理ステータス']?.select?.name || null,
    goals: {
      kcal: p['目標カロリー(kcal)']?.number ?? tenant.defaultGoals.kcal,
      P: p['目標P(g)']?.number ?? tenant.defaultGoals.P,
      F: p['目標F(g)']?.number ?? tenant.defaultGoals.F,
      C: p['目標C(g)']?.number ?? tenant.defaultGoals.C,
    },
    currentWeight: p['現在体重(kg)']?.number ?? null,
    targetWeight: p['目標体重(kg)']?.number ?? null,
    targetDate: p['目標達成日']?.date?.start ?? null,
    foodSheetPageId: (() => {
      const url = p['食事記録リンク']?.url;
      if (!url) return null;
      const m = url.match(/([a-f0-9]{32})(?:[?#].*)?$/i);
      return m ? m[1] : null;
    })(),
    gender: p['性別']?.select?.name ?? null,
    heightCm: p['身長(cm)']?.number ?? null,
    age: p['年齢']?.number ?? null,
    birthDate: p['生年月日']?.date?.start ?? null,
    email: p['メールアドレス']?.email ?? null,
    phone: p['電話番号']?.phone_number ?? null,
    activityLevel: p['活動レベル']?.select?.name ?? null,
    plan: p['プラン']?.select?.name ?? null,
    storeId: p['所属店舗']?.rich_text?.[0]?.plain_text ?? null,
    onboardingCompletedAt: p['オンボーディング完了日時']?.date?.start ?? null,
  };
  customerCache.set(lineUserId, { customer, expiry: Date.now() + CUSTOMER_CACHE_TTL_MS });
  return customer;
}

function parseCustomerPage(page: { id: string; properties: Record<string, any> }): Customer {
  const tenant = getTenantNotion();
  const p = page.properties;
  return {
    pageId: page.id,
    name: p['氏名']?.title?.[0]?.plain_text || '不明',
    furigana: p['フリガナ']?.rich_text?.[0]?.plain_text ?? null,
    lineUserId: p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '',
    foodStatus: p['食事管理ステータス']?.select?.name || null,
    goals: {
      kcal: p['目標カロリー(kcal)']?.number ?? tenant.defaultGoals.kcal,
      P: p['目標P(g)']?.number ?? tenant.defaultGoals.P,
      F: p['目標F(g)']?.number ?? tenant.defaultGoals.F,
      C: p['目標C(g)']?.number ?? tenant.defaultGoals.C,
    },
    currentWeight: p['現在体重(kg)']?.number ?? null,
    targetWeight: p['目標体重(kg)']?.number ?? null,
    targetDate: p['目標達成日']?.date?.start ?? null,
    foodSheetPageId: (() => {
      const url = p['食事記録リンク']?.url;
      if (!url) return null;
      const m = url.match(/([a-f0-9]{32})(?:[?#].*)?$/i);
      return m ? m[1] : null;
    })(),
    gender: p['性別']?.select?.name ?? null,
    heightCm: p['身長(cm)']?.number ?? null,
    age: p['年齢']?.number ?? null,
    birthDate: p['生年月日']?.date?.start ?? null,
    email: p['メールアドレス']?.email ?? null,
    phone: p['電話番号']?.phone_number ?? null,
    activityLevel: p['活動レベル']?.select?.name ?? null,
    plan: p['プラン']?.select?.name ?? null,
    storeId: p['所属店舗']?.rich_text?.[0]?.plain_text ?? null,
    onboardingCompletedAt: p['オンボーディング完了日時']?.date?.start ?? null,
  };
}

export async function listAllCustomers(): Promise<Customer[]> {
  const tenant = getTenantNotion();
  const results: Customer[] = [];
  let cursor: string | undefined;
  // 全ページ取得（最大1000人想定 → 10ページまで）
  for (let i = 0; i < 10; i++) {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest('POST', `/databases/${tenant.customerDbId}/query`, body);
    if (Array.isArray(res.results)) {
      for (const page of res.results) {
        try {
          results.push(parseCustomerPage(page));
        } catch {
          // 個別ページのパース失敗はスキップ
        }
      }
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return results;
}

export async function getCustomerByPageId(pageId: string): Promise<Customer | null> {
  try {
    const page = await notionRequest('GET', `/pages/${pageId}`);
    return parseCustomerPage(page);
  } catch {
    return null;
  }
}

// 新規顧客作成
export async function createCustomer(input: {
  name: string;
  lineUserId?: string;
  foodStatus?: string;
  gender?: string;
  heightCm?: number;
  age?: number;
  activityLevel?: string;
  plan?: string;
  currentWeight?: number;
  targetWeight?: number;
  targetDate?: string;
  goals?: { kcal?: number; P?: number; F?: number; C?: number };
  storeId?: string;
}): Promise<Customer> {
  const tenant = getTenantNotion();
  const properties: Record<string, unknown> = {
    氏名: { title: [{ text: { content: input.name.slice(0, 100) } }] },
  };
  if (input.lineUserId) {
    properties['LINEユーザーID'] = { rich_text: [{ text: { content: input.lineUserId } }] };
  }
  if (input.foodStatus) {
    properties['食事管理ステータス'] = { select: { name: input.foodStatus } };
  }
  if (input.gender) {
    properties['性別'] = { select: { name: input.gender } };
  }
  if (typeof input.heightCm === 'number') {
    properties['身長(cm)'] = { number: input.heightCm };
  }
  if (typeof input.age === 'number') {
    properties['年齢'] = { number: input.age };
  }
  if (input.activityLevel) {
    properties['活動レベル'] = { select: { name: input.activityLevel } };
  }
  if (input.plan) {
    properties['プラン'] = { select: { name: input.plan } };
  }
  if (typeof input.currentWeight === 'number') {
    properties['現在体重(kg)'] = { number: input.currentWeight };
  }
  if (typeof input.targetWeight === 'number') {
    properties['目標体重(kg)'] = { number: input.targetWeight };
  }
  if (input.targetDate) {
    properties['目標達成日'] = { date: { start: input.targetDate } };
  }
  if (input.goals) {
    if (typeof input.goals.kcal === 'number') properties['目標カロリー(kcal)'] = { number: input.goals.kcal };
    if (typeof input.goals.P === 'number') properties['目標P(g)'] = { number: input.goals.P };
    if (typeof input.goals.F === 'number') properties['目標F(g)'] = { number: input.goals.F };
    if (typeof input.goals.C === 'number') properties['目標C(g)'] = { number: input.goals.C };
  }
  if (input.storeId) {
    properties['所属店舗'] = { rich_text: [{ text: { content: input.storeId } }] };
  }
  const res = await notionRequest('POST', '/pages', {
    parent: { database_id: tenant.customerDbId },
    properties,
  });
  return parseCustomerPage(res);
}

export async function updateCustomer(
  pageId: string,
  patch: {
    name?: string;
    goals?: { kcal?: number; P?: number; F?: number; C?: number };
    targetWeight?: number | null;
    targetDate?: string | null;
    foodStatus?: string | null;
    gender?: string | null;
    heightCm?: number | null;
    age?: number | null;
    activityLevel?: string | null;
    plan?: string | null;
    currentWeight?: number | null;
    storeId?: string | null;
    lineUserId?: string | null;
    onboardingCompletedAt?: string | null;
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (patch.name !== undefined && patch.name.trim()) {
    properties['氏名'] = { title: [{ text: { content: patch.name.trim().slice(0, 100) } }] };
  }
  if (patch.goals) {
    if (typeof patch.goals.kcal === 'number') properties['目標カロリー(kcal)'] = { number: patch.goals.kcal };
    if (typeof patch.goals.P === 'number') properties['目標P(g)'] = { number: patch.goals.P };
    if (typeof patch.goals.F === 'number') properties['目標F(g)'] = { number: patch.goals.F };
    if (typeof patch.goals.C === 'number') properties['目標C(g)'] = { number: patch.goals.C };
  }
  if (patch.targetWeight !== undefined) {
    properties['目標体重(kg)'] = patch.targetWeight === null ? { number: null } : { number: patch.targetWeight };
  }
  if (patch.targetDate !== undefined) {
    properties['目標達成日'] = patch.targetDate === null ? { date: null } : { date: { start: patch.targetDate } };
  }
  if (patch.foodStatus !== undefined) {
    properties['食事管理ステータス'] = patch.foodStatus === null ? { select: null } : { select: { name: patch.foodStatus } };
  }
  if (patch.gender !== undefined) {
    properties['性別'] = patch.gender === null ? { select: null } : { select: { name: patch.gender } };
  }
  if (patch.heightCm !== undefined) {
    properties['身長(cm)'] = patch.heightCm === null ? { number: null } : { number: patch.heightCm };
  }
  if (patch.age !== undefined) {
    properties['年齢'] = patch.age === null ? { number: null } : { number: patch.age };
  }
  if (patch.activityLevel !== undefined) {
    properties['活動レベル'] = patch.activityLevel === null ? { select: null } : { select: { name: patch.activityLevel } };
  }
  if (patch.plan !== undefined) {
    properties['プラン'] = patch.plan === null ? { select: null } : { select: { name: patch.plan } };
  }
  if (patch.storeId !== undefined) {
    properties['所属店舗'] = patch.storeId
      ? { rich_text: [{ type: 'text', text: { content: patch.storeId } }] }
      : { rich_text: [] };
  }
  if (patch.lineUserId !== undefined) {
    properties['LINEユーザーID'] = patch.lineUserId
      ? { rich_text: [{ type: 'text', text: { content: patch.lineUserId } }] }
      : { rich_text: [] };
  }
  if (patch.currentWeight !== undefined) {
    properties['現在体重(kg)'] = patch.currentWeight === null ? { number: null } : { number: patch.currentWeight };
  }
  if (patch.onboardingCompletedAt !== undefined) {
    properties['オンボーディング完了日時'] = patch.onboardingCompletedAt === null
      ? { date: null }
      : { date: { start: patch.onboardingCompletedAt } };
  }
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${pageId}`, { properties });
  customerCache.clear();
}

// 食事記録を削除（Notionページをarchive扱いに）
export async function deleteFoodRecord(pageId: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${pageId}`, { archived: true });
}

// ===== テナント自動プロビジョニング =====

// 新規ジム用の「{ジム名} 顧客」DB を作成。FitMeal 顧客スキーマと同じ構造。
export async function createTenantCustomerDb(
  tenantName: string,
  parentPageId: string
): Promise<string> {
  const res = await notionRequest('POST', '/databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: `${tenantName} 顧客` } }],
    properties: {
      氏名: { title: {} },
      LINEユーザーID: { rich_text: {} },
      食事管理ステータス: {
        select: {
          options: [
            { name: '設定中', color: 'purple' },
            { name: '進行中', color: 'green' },
            { name: '休止中', color: 'orange' },
            { name: '卒業', color: 'blue' },
          ],
        },
      },
      性別: {
        select: {
          options: [
            { name: '男性', color: 'blue' },
            { name: '女性', color: 'pink' },
          ],
        },
      },
      '身長(cm)': { number: {} },
      年齢: { number: {} },
      活動レベル: {
        select: {
          options: [
            { name: 'ほぼ運動なし', color: 'gray' },
            { name: '軽い', color: 'blue' },
            { name: '中等度', color: 'green' },
            { name: '激しい', color: 'orange' },
          ],
        },
      },
      プラン: {
        select: {
          options: [
            { name: '減量', color: 'red' },
            { name: '増量', color: 'green' },
            { name: '筋肥大', color: 'purple' },
            { name: '現状維持', color: 'gray' },
          ],
        },
      },
      '現在体重(kg)': { number: {} },
      '目標体重(kg)': { number: {} },
      目標達成日: { date: {} },
      '目標カロリー(kcal)': { number: {} },
      '目標P(g)': { number: {} },
      '目標F(g)': { number: {} },
      '目標C(g)': { number: {} },
      所属店舗: { rich_text: {} },
      食事記録リンク: { url: {} },
    },
  });
  return res.id as string;
}

// 新規ジム用の「{ジム名} 食事記録」DB を作成。既存食事記録DBと同じ構造。
export async function createTenantFoodDb(
  tenantName: string,
  parentPageId: string
): Promise<string> {
  const res = await notionRequest('POST', '/databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: `${tenantName} 食事記録` } }],
    properties: {
      タイトル: { title: {} },
      LINEユーザーID: { rich_text: {} },
      日付: { date: {} },
      食事区分: {
        select: {
          options: [
            { name: '朝食', color: 'orange' },
            { name: '昼食', color: 'yellow' },
            { name: '夕食', color: 'purple' },
            { name: '間食', color: 'pink' },
          ],
        },
      },
      カロリー_kcal: { number: {} },
      タンパク質_g: { number: {} },
      脂質_g: { number: {} },
      炭水化物_g: { number: {} },
      食物繊維_g: { number: {} },
      塩分_g: { number: {} },
      鉄分_mg: { number: {} },
      カルシウム_mg: { number: {} },
      ビタミンC_mg: { number: {} },
      食材メモ: { rich_text: {} },
      画像URL: { url: {} },
      記録日時: { date: {} },
    },
  });
  return res.id as string;
}

// 新規ジム用の「{ジム名} 体重ログ」DB を作成。
export async function createTenantWeightDb(
  tenantName: string,
  parentPageId: string
): Promise<string> {
  const res = await notionRequest('POST', '/databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: `${tenantName} 体重ログ` } }],
    properties: {
      日付: { title: {} },
      '体重(kg)': { number: {} },
      LINEユーザーID: { rich_text: {} },
      顧客名: { rich_text: {} },
      メモ: { rich_text: {} },
      入力経路: {
        select: {
          options: [
            { name: 'LIFF', color: 'green' },
            { name: '管理画面', color: 'blue' },
            { name: 'GAS', color: 'orange' },
            { name: '移行', color: 'gray' },
          ],
        },
      },
    },
  });
  return res.id as string;
}

// テナントDBに新規行を追加
export async function insertTenantRow(
  tenantsDbId: string,
  row: {
    name: string;
    tenantId: string;
    plan: string;
    customerDbId: string;
    foodDbId: string;
    weightDbId?: string;
    ownerEmail: string;
    startDate: string;
    note?: string;
  }
): Promise<string> {
  const properties: Record<string, unknown> = {
    ジム名: { title: [{ type: 'text', text: { content: row.name } }] },
    tenant_id: { rich_text: [{ type: 'text', text: { content: row.tenantId } }] },
    プラン: { select: { name: row.plan } },
    'Notion 顧客DB ID': { rich_text: [{ type: 'text', text: { content: row.customerDbId } }] },
    'Notion 食事DB ID': { rich_text: [{ type: 'text', text: { content: row.foodDbId } }] },
    オーナーメール: { email: row.ownerEmail },
    契約状態: { select: { name: 'アクティブ' } },
    契約開始日: { date: { start: row.startDate } },
    備考: row.note ? { rich_text: [{ type: 'text', text: { content: row.note } }] } : { rich_text: [] },
  };
  if (row.weightDbId) {
    properties['Notion 体重DB ID'] = { rich_text: [{ type: 'text', text: { content: row.weightDbId } }] };
  }
  const res = await notionRequest('POST', '/pages', {
    parent: { database_id: tenantsDbId },
    properties,
  });
  return res.id as string;
}

// テナント一覧を Notion から取得
export type TenantRow = {
  pageId: string;
  name: string;
  tenantId: string;
  plan: string | null;
  customerDbId: string | null;
  foodDbId: string | null;
  weightDbId: string | null;
  officialLineUrl: string | null;
  liffId: string | null;
  ownerEmail: string | null;
  status: string | null;
  startDate: string | null;
  passwordHash: string | null;
  lineChannelToken: string | null;
  lineAutoSendEnabled: boolean;
  /** "HH:MM" 形式の JST 送信時刻。未設定なら "06:00" 想定 */
  autoSendTime: string | null;
  /** Stripe 連携用 */
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paymentStatus: string | null;
  nextBillingDate: string | null;
  customerCount: number | null;
  monthlyPrice: number | null;
  billingCycle: string | null;
  /** PFC キャリブレーション（自動算出。cron が日次更新） */
  pfcRecommendedP: number | null;
  pfcRecommendedF: number | null;
  pfcRecommendedC: number | null;
  /** PFC キャリブレーション（手動オーバーライド。空なら推奨値を使用） */
  pfcOverrideP: number | null;
  pfcOverrideF: number | null;
  pfcOverrideC: number | null;
};

export async function updateTenantRow(
  pageId: string,
  patch: {
    liffId?: string | null;
    plan?: string;
    ownerEmail?: string;
    status?: string;
    note?: string;
    lineChannelToken?: string | null;
    lineAutoSendEnabled?: boolean;
    autoSendTime?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    paymentStatus?: string;
    nextBillingDate?: string | null;
    customerCount?: number;
    monthlyPrice?: number;
    billingCycle?: string;
    pfcRecommendedP?: number | null;
    pfcRecommendedF?: number | null;
    pfcRecommendedC?: number | null;
    pfcOverrideP?: number | null;
    pfcOverrideF?: number | null;
    pfcOverrideC?: number | null;
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (patch.liffId !== undefined) {
    properties['LIFF ID'] = patch.liffId
      ? { rich_text: [{ type: 'text', text: { content: patch.liffId } }] }
      : { rich_text: [] };
  }
  if (patch.plan !== undefined) properties['プラン'] = { select: { name: patch.plan } };
  if (patch.ownerEmail !== undefined) properties['オーナーメール'] = { email: patch.ownerEmail };
  if (patch.status !== undefined) properties['契約状態'] = { select: { name: patch.status } };
  if (patch.note !== undefined) {
    properties['備考'] = patch.note
      ? { rich_text: [{ type: 'text', text: { content: patch.note } }] }
      : { rich_text: [] };
  }
  if (patch.lineChannelToken !== undefined) {
    properties['LINE Channel Token'] = patch.lineChannelToken
      ? { rich_text: [{ type: 'text', text: { content: patch.lineChannelToken } }] }
      : { rich_text: [] };
  }
  if (patch.lineAutoSendEnabled !== undefined) {
    properties['LINE自動送付'] = { checkbox: patch.lineAutoSendEnabled };
  }
  if (patch.autoSendTime !== undefined) {
    properties['自動送付時刻'] = patch.autoSendTime
      ? { rich_text: [{ type: 'text', text: { content: patch.autoSendTime } }] }
      : { rich_text: [] };
  }
  if (patch.stripeCustomerId !== undefined) {
    properties['Stripe Customer ID'] = patch.stripeCustomerId
      ? { rich_text: [{ type: 'text', text: { content: patch.stripeCustomerId } }] }
      : { rich_text: [] };
  }
  if (patch.stripeSubscriptionId !== undefined) {
    properties['Stripe Subscription ID'] = patch.stripeSubscriptionId
      ? { rich_text: [{ type: 'text', text: { content: patch.stripeSubscriptionId } }] }
      : { rich_text: [] };
  }
  if (patch.paymentStatus !== undefined) {
    properties['支払いステータス'] = { select: { name: patch.paymentStatus } };
  }
  if (patch.nextBillingDate !== undefined) {
    properties['次回請求日'] = patch.nextBillingDate
      ? { date: { start: patch.nextBillingDate } }
      : { date: null };
  }
  if (patch.customerCount !== undefined) {
    properties['顧客数'] = { number: patch.customerCount };
  }
  if (patch.monthlyPrice !== undefined) {
    properties['月額料金'] = { number: patch.monthlyPrice };
  }
  if (patch.billingCycle !== undefined) {
    properties['請求サイクル'] = { select: { name: patch.billingCycle } };
  }
  const pfcMap: Array<[string, number | null | undefined]> = [
    ['PFC推奨_P', patch.pfcRecommendedP],
    ['PFC推奨_F', patch.pfcRecommendedF],
    ['PFC推奨_C', patch.pfcRecommendedC],
    ['PFC適用_P', patch.pfcOverrideP],
    ['PFC適用_F', patch.pfcOverrideF],
    ['PFC適用_C', patch.pfcOverrideC],
  ];
  for (const [colName, value] of pfcMap) {
    if (value !== undefined) {
      properties[colName] = { number: value };
    }
  }
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${pageId}`, { properties });
}

export async function listTenantRows(tenantsDbId: string): Promise<TenantRow[]> {
  const data = await notionRequest('POST', `/databases/${tenantsDbId}/query`, { page_size: 100 });
  return (data.results || []).map((page: { id: string; properties: Record<string, any> }) => {
    const p = page.properties;
    return {
      pageId: page.id,
      name: p['ジム名']?.title?.[0]?.plain_text || '(無名)',
      tenantId: p['tenant_id']?.rich_text?.[0]?.plain_text || '',
      plan: p['プラン']?.select?.name || null,
      customerDbId: p['Notion 顧客DB ID']?.rich_text?.[0]?.plain_text || null,
      foodDbId: p['Notion 食事DB ID']?.rich_text?.[0]?.plain_text || null,
      weightDbId: p['Notion 体重DB ID']?.rich_text?.[0]?.plain_text || null,
      officialLineUrl: p['公式LINE URL']?.url || null,
      liffId: p['LIFF ID']?.rich_text?.[0]?.plain_text || null,
      ownerEmail: p['オーナーメール']?.email || null,
      status: p['契約状態']?.select?.name || null,
      startDate: p['契約開始日']?.date?.start || null,
      passwordHash: p['パスワードハッシュ']?.rich_text?.[0]?.plain_text || null,
      lineChannelToken: p['LINE Channel Token']?.rich_text?.[0]?.plain_text || null,
      lineAutoSendEnabled: !!p['LINE自動送付']?.checkbox,
      autoSendTime: p['自動送付時刻']?.rich_text?.[0]?.plain_text || null,
      stripeCustomerId: p['Stripe Customer ID']?.rich_text?.[0]?.plain_text || null,
      stripeSubscriptionId: p['Stripe Subscription ID']?.rich_text?.[0]?.plain_text || null,
      paymentStatus: p['支払いステータス']?.select?.name || null,
      nextBillingDate: p['次回請求日']?.date?.start || null,
      customerCount: p['顧客数']?.number ?? null,
      monthlyPrice: p['月額料金']?.number ?? null,
      billingCycle: p['請求サイクル']?.select?.name || null,
      pfcRecommendedP: p['PFC推奨_P']?.number ?? null,
      pfcRecommendedF: p['PFC推奨_F']?.number ?? null,
      pfcRecommendedC: p['PFC推奨_C']?.number ?? null,
      pfcOverrideP: p['PFC適用_P']?.number ?? null,
      pfcOverrideF: p['PFC適用_F']?.number ?? null,
      pfcOverrideC: p['PFC適用_C']?.number ?? null,
    };
  });
}

/** テナント admin のパスワードハッシュを設定（マスタ専用） */
export async function setTenantPasswordHash(pageId: string, passwordHash: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${pageId}`, {
    properties: {
      パスワードハッシュ: { rich_text: [{ type: 'text', text: { content: passwordHash } }] },
    },
  });
}

// 食事記録のPFC・カロリー・メモを部分更新
// correctedBy: 'AI' | '顧客' | 'トレーナー' — 補正者を記録（AI学習データ抽出用）
export async function updateFoodRecord(
  pageId: string,
  patch: {
    kcal?: number;
    P?: number;
    F?: number;
    C?: number;
    memo?: string;
    correctedBy?: 'AI' | '顧客' | 'トレーナー';
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (typeof patch.kcal === 'number') properties['カロリー_kcal'] = { number: patch.kcal };
  if (typeof patch.P === 'number') properties['タンパク質_g'] = { number: patch.P };
  if (typeof patch.F === 'number') properties['脂質_g'] = { number: patch.F };
  if (typeof patch.C === 'number') properties['炭水化物_g'] = { number: patch.C };
  if (typeof patch.memo === 'string') {
    properties['食材メモ'] = { rich_text: [{ text: { content: patch.memo } }] };
  }
  if (patch.correctedBy) {
    properties['補正者'] = { select: { name: patch.correctedBy } };
  }
  if (Object.keys(properties).length === 0) return;
  try {
    await notionRequest('PATCH', `/pages/${pageId}`, { properties });
  } catch (e) {
    // 「補正者」列が未追加のテナント向け：補正者を除いて再試行
    const message = e instanceof Error ? e.message : '';
    if (patch.correctedBy && /補正者|property/i.test(message)) {
      delete (properties as Record<string, unknown>)['補正者'];
      await notionRequest('PATCH', `/pages/${pageId}`, { properties });
      return;
    }
    throw e;
  }
}

// 個人シートの食事記録テーブルから複数日付の体重・運動データをまとめて取得
export async function getRangeExtras(
  sheetPageId: string,
  dateLabels: string[]
): Promise<Record<string, { weight: string; exercised: boolean; exerciseContent: string }>> {
  try {
    const blocks = await fetchAllNotionBlocksRaw(sheetPageId);
    let afterHeading = false;
    let tableId: string | null = null;
    for (const block of blocks) {
      if (block.type === 'heading_2') {
        const text = (block.heading_2?.rich_text || [])
          .map((rt: { plain_text?: string }) => rt.plain_text || '')
          .join('');
        afterHeading =
          text.includes('食事記録') || text === '📝 記録' || text === '📅 記録';
      } else if (afterHeading && block.type === 'table') {
        tableId = block.id;
        break;
      } else if (afterHeading && block.type === 'heading_2') {
        afterHeading = false;
      }
    }
    const result: Record<string, { weight: string; exercised: boolean; exerciseContent: string }> = {};
    if (!tableId) return result;

    const rows = await fetchAllNotionBlocksRaw(tableId);
    const labelSet = new Set(dateLabels);
    for (const row of rows) {
      if (row.type !== 'table_row') continue;
      const cells = row.table_row?.cells || [];
      const dateCell = (cells[0] || [])
        .map((rt: { plain_text?: string }) => rt.plain_text || '')
        .join('')
        .trim();
      if (!labelSet.has(dateCell)) continue;
      const get = (i: number) =>
        ((cells[i] || []) as Array<{ plain_text?: string }>)
          .map((rt) => rt.plain_text || '')
          .join('')
          .trim();
      result[dateCell] = {
        weight: get(1),
        exercised: get(9) === '✅',
        exerciseContent: get(10),
      };
    }
    return result;
  } catch (e) {
    console.error('getRangeExtras failed:', e);
    return {};
  }
}

// 個人シートの食事記録テーブルから当日の体重・運動・運動内容を取得
export async function getDailyExtras(
  sheetPageId: string,
  dateLabel: string
): Promise<{ weight: string; exercised: string; exerciseContent: string }> {
  try {
    const blocks = await fetchAllNotionBlocksRaw(sheetPageId);
    let afterHeading = false;
    let tableId: string | null = null;
    for (const block of blocks) {
      if (block.type === 'heading_2') {
        const text = (block.heading_2?.rich_text || [])
          .map((rt: { plain_text?: string }) => rt.plain_text || '')
          .join('');
        afterHeading =
          text.includes('食事記録') || text === '📝 記録' || text === '📅 記録';
      } else if (afterHeading && block.type === 'table') {
        tableId = block.id;
        break;
      } else if (afterHeading && block.type === 'heading_2') {
        afterHeading = false;
      }
    }
    if (!tableId) return { weight: '', exercised: '', exerciseContent: '' };

    const rows = await fetchAllNotionBlocksRaw(tableId);
    for (const row of rows) {
      if (row.type !== 'table_row') continue;
      const cells = row.table_row?.cells || [];
      const dateCell = (cells[0] || [])
        .map((rt: { plain_text?: string }) => rt.plain_text || '')
        .join('')
        .trim();
      if (dateCell === dateLabel) {
        const get = (i: number) =>
          ((cells[i] || []) as Array<{ plain_text?: string }>)
            .map((rt) => rt.plain_text || '')
            .join('')
            .trim();
        return {
          weight: get(1),
          exercised: get(9),
          exerciseContent: get(10),
        };
      }
    }
    return { weight: '', exercised: '', exerciseContent: '' };
  } catch (e) {
    console.error('getDailyExtras failed:', e);
    return { weight: '', exercised: '', exerciseContent: '' };
  }
}

async function fetchAllNotionBlocksRaw(blockId: string): Promise<Array<Record<string, unknown> & { id: string; type: string; heading_2?: { rich_text?: Array<{ plain_text: string }> }; table_row?: { cells: Array<Array<{ plain_text: string }>> } }>> {
  const results: Array<Record<string, unknown> & { id: string; type: string; heading_2?: { rich_text?: Array<{ plain_text: string }> }; table_row?: { cells: Array<Array<{ plain_text: string }>> } }> = [];
  let cursor: string | null = null;
  do {
    const path = `/blocks/${blockId}/children${cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await notionRequest('GET', path);
    if (Array.isArray(res.results)) results.push(...(res.results as typeof results));
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return results;
}

// 'yyyy-MM-dd' → 'M月d日'
export function isoToJpMd(dateString: string): string {
  const [, m, d] = dateString.split('-').map(Number);
  return `${m}月${d}日`;
}

// 指定期間の食事記録を取得（時刻順）
export async function getFoodRecordsByDateRange(
  lineUserId: string,
  startDate: string,
  endDate: string
): Promise<FoodRecord[]> {
  const res = await notionRequest('POST', `/databases/${getTenantNotion().foodDbId}/query`, {
    filter: {
      and: [
        { property: 'LINE_UserID', rich_text: { equals: lineUserId } },
        { property: '日付', date: { on_or_after: startDate } },
        { property: '日付', date: { on_or_before: endDate } },
      ],
    },
    sorts: [
      { property: '日付', direction: 'ascending' },
      { timestamp: 'created_time', direction: 'ascending' },
    ],
    page_size: 100,
  });
  return (res.results || []).map(notionPageToFoodRecord);
}

function notionPageToFoodRecord(page: { id: string; properties: Record<string, unknown>; created_time: string }): FoodRecord {
  const p = page.properties as Record<string, { number?: number; select?: { name: string }; rich_text?: Array<{ plain_text: string }>; url?: string; title?: Array<{ plain_text: string }>; date?: { start: string } }>;
  // 詳細栄養素は JSON 文字列として保存されているので parse
  let details: NutritionDetailsRecord | null = null;
  const detailsText = p['詳細栄養素']?.rich_text?.[0]?.plain_text;
  if (detailsText) {
    try {
      const parsed = JSON.parse(detailsText);
      details = {
        fiber: Number(parsed.fiber ?? 0),
        salt: Number(parsed.salt ?? 0),
        iron: Number(parsed.iron ?? 0),
        calcium: Number(parsed.calcium ?? 0),
        vitaminC: Number(parsed.vitaminC ?? 0),
      };
    } catch {
      details = null;
    }
  }
  return {
    pageId: page.id,
    mealType: p['食事区分']?.select?.name || '',
    date: p['日付']?.date?.start || '',
    recordedAt: page.created_time,
    kcal: p['カロリー_kcal']?.number || 0,
    P: p['タンパク質_g']?.number || 0,
    F: p['脂質_g']?.number || 0,
    C: p['炭水化物_g']?.number || 0,
    memo: p['食材メモ']?.rich_text?.[0]?.plain_text || '',
    imageUrl: p['画像URL']?.url || null,
    title: p['食事メモ']?.title?.[0]?.plain_text || '',
    details,
    lineUserId: p['LINE_UserID']?.rich_text?.[0]?.plain_text || undefined,
  };
}

export async function getAllFoodRecordsByDateRange(
  startDate: string,
  endDate: string
): Promise<FoodRecord[]> {
  const tenant = getTenantNotion();
  const results: FoodRecord[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const body: Record<string, unknown> = {
      filter: {
        and: [
          { property: '日付', date: { on_or_after: startDate } },
          { property: '日付', date: { on_or_before: endDate } },
        ],
      },
      sorts: [
        { property: '日付', direction: 'descending' },
        { timestamp: 'created_time', direction: 'descending' },
      ],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest('POST', `/databases/${tenant.foodDbId}/query`, body);
    if (Array.isArray(res.results)) {
      for (const page of res.results) {
        try {
          results.push(notionPageToFoodRecord(page));
        } catch {
          // skip
        }
      }
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return results;
}

// AI補正データ分析用：日付範囲内の全顧客の食事記録から AI推定値 vs 現在値の差分を計算
export type CorrectionRecord = {
  pageId: string;
  date: string;
  mealType: string;
  customer: string;
  current: { kcal: number; P: number; F: number; C: number };
  aiOriginal: { kcal: number; P: number; F: number; C: number };
  diff: { kcal: number; P: number; F: number; C: number };
  hasCorrection: boolean;
  /** 補正者: 'AI'（未補正）/ '顧客' / 'トレーナー' */
  correctedBy: 'AI' | '顧客' | 'トレーナー' | null;
};

export async function getCorrectionRecords(
  startDate: string,
  endDate: string
): Promise<CorrectionRecord[]> {
  const records: CorrectionRecord[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: {
        and: [
          { property: '日付', date: { on_or_after: startDate } },
          { property: '日付', date: { on_or_before: endDate } },
        ],
      },
      sorts: [{ property: '日付', direction: 'ascending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest(
      'POST',
      `/databases/${getTenantNotion().foodDbId}/query`,
      body
    );
    for (const page of res.results || []) {
      const p = page.properties as Record<string, {
        number?: number;
        select?: { name: string };
        rich_text?: Array<{ plain_text: string }>;
        date?: { start: string };
      }>;
      const current = {
        kcal: p['カロリー_kcal']?.number || 0,
        P: p['タンパク質_g']?.number || 0,
        F: p['脂質_g']?.number || 0,
        C: p['炭水化物_g']?.number || 0,
      };
      const aiOriginal = {
        kcal: p['AI推定_kcal']?.number ?? null,
        P: p['AI推定_P']?.number ?? null,
        F: p['AI推定_F']?.number ?? null,
        C: p['AI推定_C']?.number ?? null,
      };
      // AI推定値が存在しないレコードは除外（旧データ or プロパティ未追加）
      if (aiOriginal.kcal === null) continue;
      const ai = {
        kcal: aiOriginal.kcal as number,
        P: aiOriginal.P as number,
        F: aiOriginal.F as number,
        C: aiOriginal.C as number,
      };
      const diff = {
        kcal: current.kcal - ai.kcal,
        P: Math.round((current.P - ai.P) * 10) / 10,
        F: Math.round((current.F - ai.F) * 10) / 10,
        C: Math.round((current.C - ai.C) * 10) / 10,
      };
      const hasCorrection =
        diff.kcal !== 0 || diff.P !== 0 || diff.F !== 0 || diff.C !== 0;
      const correctedByName = p['補正者']?.select?.name as 'AI' | '顧客' | 'トレーナー' | undefined;
      records.push({
        pageId: page.id,
        date: p['日付']?.date?.start || '',
        mealType: p['食事区分']?.select?.name || '',
        customer: p['顧客名']?.rich_text?.[0]?.plain_text || '',
        current,
        aiOriginal: ai,
        diff,
        hasCorrection,
        correctedBy: correctedByName ?? null,
      });
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return records;
}

// 指定日の食事記録を取得（時刻順）
export async function getFoodRecordsByDate(
  lineUserId: string,
  dateString: string
): Promise<FoodRecord[]> {
  const res = await notionRequest('POST', `/databases/${getTenantNotion().foodDbId}/query`, {
    filter: {
      and: [
        { property: 'LINE_UserID', rich_text: { equals: lineUserId } },
        { property: '日付', date: { equals: dateString } },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return (res.results || []).map(notionPageToFoodRecord);
}

export async function saveFoodRecord(params: {
  customerName: string;
  lineUserId: string;
  pfc: {
    kcal: number;
    P: number;
    F: number;
    C: number;
    items?: Array<{ name: string }>;
    details?: {
      fiber: number;
      salt: number;
      iron: number;
      calcium: number;
      vitaminC: number;
    };
  };
  mealType: string;
  imageUrl?: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  targetDate: string;
  supplementText?: string | null;
}) {
  const {
    customerName,
    lineUserId,
    pfc,
    mealType,
    imageUrl,
    goals,
    targetDate,
    supplementText,
  } = params;
  const timeStr = nowJstHHmm();
  const aiItems = (pfc.items || [])
    .map((i) => (i.name || '').trim())
    .filter(Boolean);
  const supplement = (supplementText || '').trim();
  // AI識別の食材と顧客メモを重複排除して併記
  const supplementAsList = supplement
    ? supplement.split(/[、,]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const combinedSet = new Set<string>([...supplementAsList, ...aiItems]);
  const itemsList = aiItems.join('、');
  const combinedList = Array.from(combinedSet).join('、');
  const memo =
    supplement && itemsList
      ? `${supplement} / AI識別: ${itemsList}`
      : combinedList || supplement || '';

  const properties: Record<string, unknown> = {
    食事メモ: { title: [{ text: { content: `${mealType} ${timeStr}` } }] },
    顧客名: { rich_text: [{ text: { content: customerName } }] },
    LINE_UserID: { rich_text: [{ text: { content: lineUserId } }] },
    日付: { date: { start: targetDate } },
    食事区分: { select: { name: mealType } },
    カロリー_kcal: { number: pfc.kcal },
    タンパク質_g: { number: pfc.P },
    脂質_g: { number: pfc.F },
    炭水化物_g: { number: pfc.C },
    食材メモ: { rich_text: [{ text: { content: memo } }] },
    目標カロリー: { number: goals.kcal },
    目標P_g: { number: goals.P },
    目標F_g: { number: goals.F },
    目標C_g: { number: goals.C },
    // AI推定値（補正前の元の値）を保存。
    // トレーナーが後からカロリー_kcal等を補正してもこちらは残る。
    // → AI精度向上のためのフィードバックデータとして活用。
    AI推定_kcal: { number: pfc.kcal },
    AI推定_P: { number: pfc.P },
    AI推定_F: { number: pfc.F },
    AI推定_C: { number: pfc.C },
  };
  if (imageUrl) properties['画像URL'] = { url: imageUrl };
  // 詳細栄養素（あれば JSON 文字列で保存）
  if (pfc.details) {
    properties['詳細栄養素'] = {
      rich_text: [{ text: { content: JSON.stringify(pfc.details) } }],
    };
  }

  // 最初は AI推定_* プロパティを含めて保存を試みる
  // 該当プロパティが Notion DB にない場合は除外して再試行（後方互換）
  try {
    return await notionRequest('POST', '/pages', {
      parent: { database_id: getTenantNotion().foodDbId },
      properties,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // AI推定_* がDBに存在しない場合のエラーをキャッチ
    if (msg.includes('AI推定_') || msg.includes('詳細栄養素') || msg.includes('not exist')) {
      const fallbackProps = { ...properties };
      delete fallbackProps['AI推定_kcal'];
      delete fallbackProps['詳細栄養素'];
      delete fallbackProps['AI推定_P'];
      delete fallbackProps['AI推定_F'];
      delete fallbackProps['AI推定_C'];
      // eslint-disable-next-line no-console
      console.warn('AI推定_* プロパティが Notion DB に未追加。フォールバック保存。');
      return await notionRequest('POST', '/pages', {
        parent: { database_id: getTenantNotion().foodDbId },
        properties: fallbackProps,
      });
    }
    throw e;
  }
}

// JST の "yyyy-MM-dd"
export function getTargetDate(dayLabel: string | undefined): string {
  const jstNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  );
  if (dayLabel === '昨日') jstNow.setDate(jstNow.getDate() - 1);
  const y = jstNow.getFullYear();
  const m = String(jstNow.getMonth() + 1).padStart(2, '0');
  const d = String(jstNow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nowJstHHmm(): string {
  const jst = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  );
  const h = String(jst.getHours()).padStart(2, '0');
  const m = String(jst.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
