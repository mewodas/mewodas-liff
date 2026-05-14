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
  activityLevel: string | null;
  plan: string | null;
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
const CUSTOMER_CACHE_TTL_MS = 5 * 60 * 1000; // 5分

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
    activityLevel: p['活動レベル']?.select?.name ?? null,
    plan: p['プラン']?.select?.name ?? null,
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
    activityLevel: p['活動レベル']?.select?.name ?? null,
    plan: p['プラン']?.select?.name ?? null,
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

export async function updateCustomer(
  pageId: string,
  patch: {
    goals?: { kcal?: number; P?: number; F?: number; C?: number };
    targetWeight?: number | null;
    targetDate?: string | null;
    foodStatus?: string | null;
    gender?: string | null;
    heightCm?: number | null;
    age?: number | null;
    activityLevel?: string | null;
    plan?: string | null;
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};
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
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${pageId}`, { properties });
  // キャッシュは lineUserId キーなので全クリアはせず、関連エントリを除去
  customerCache.clear();
}

// 食事記録を削除（Notionページをarchive扱いに）
export async function deleteFoodRecord(pageId: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${pageId}`, { archived: true });
}

// 食事記録のPFC・カロリー・メモを部分更新
export async function updateFoodRecord(
  pageId: string,
  patch: {
    kcal?: number;
    P?: number;
    F?: number;
    C?: number;
    memo?: string;
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
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${pageId}`, { properties });
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
      records.push({
        pageId: page.id,
        date: p['日付']?.date?.start || '',
        mealType: p['食事区分']?.select?.name || '',
        customer: p['顧客名']?.rich_text?.[0]?.plain_text || '',
        current,
        aiOriginal: ai,
        diff,
        hasCorrection,
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
