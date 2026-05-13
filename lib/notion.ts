const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

const NOTION_FOOD_DB_ID = '8719d5ab23074ea5bf6e77fde352db86';
const NOTION_CUSTOMER_DB_ID = '7324e5a590ad46a595f0c6fc58c34816';

const DEFAULT_GOALS = { kcal: 2000, P: 100, F: 56, C: 275 };

export type Customer = {
  pageId: string;
  name: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
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
};

async function notionRequest(
  method: string,
  path: string,
  payload?: object
): Promise<any> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error('NOTION_API_KEY 未設定');
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

export async function getCustomerByLineId(
  lineUserId: string
): Promise<Customer | null> {
  const res = await notionRequest(
    'POST',
    `/databases/${NOTION_CUSTOMER_DB_ID}/query`,
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
  return {
    pageId: page.id,
    name: p['氏名']?.title?.[0]?.plain_text || '不明',
    foodStatus: p['食事管理ステータス']?.select?.name || null,
    goals: {
      kcal: p['目標カロリー(kcal)']?.number ?? DEFAULT_GOALS.kcal,
      P: p['目標P(g)']?.number ?? DEFAULT_GOALS.P,
      F: p['目標F(g)']?.number ?? DEFAULT_GOALS.F,
      C: p['目標C(g)']?.number ?? DEFAULT_GOALS.C,
    },
    currentWeight: p['現在体重(kg)']?.number ?? null,
    targetWeight: p['目標体重(kg)']?.number ?? null,
    targetDate: p['目標達成日']?.date?.start ?? null,
  };
}

// 指定期間の食事記録を取得（時刻順）
export async function getFoodRecordsByDateRange(
  lineUserId: string,
  startDate: string,
  endDate: string
): Promise<FoodRecord[]> {
  const res = await notionRequest('POST', `/databases/${NOTION_FOOD_DB_ID}/query`, {
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
  };
}

// 指定日の食事記録を取得（時刻順）
export async function getFoodRecordsByDate(
  lineUserId: string,
  dateString: string
): Promise<FoodRecord[]> {
  const res = await notionRequest('POST', `/databases/${NOTION_FOOD_DB_ID}/query`, {
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
  pfc: { kcal: number; P: number; F: number; C: number; items?: Array<{ name: string }> };
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
  };
  if (imageUrl) properties['画像URL'] = { url: imageUrl };

  return notionRequest('POST', '/pages', {
    parent: { database_id: NOTION_FOOD_DB_ID },
    properties,
  });
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
