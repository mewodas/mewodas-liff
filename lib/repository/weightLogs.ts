import { getCurrentTenant } from '@/lib/tenant';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';
// Notion 一時障害（429/502/503/504）・ネットワーク断は指数バックオフで最大3回リトライ。
// （中央 lib/notion.ts と同方式。この repo は自前 notionRequest のためリトライが無く、
//   体重記録の保存が一時エラーで間欠的に失敗していた）
const NOTION_RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export type WeightLog = {
  id: string;
  lineUserId: string;
  customerName: string;
  date: string;
  weightKg: number;
  memo: string;
  source: string;
  createdAt: string;
};

function getWeightDbId(): string {
  return getCurrentTenant().notionWeightDbId || '';
}

function getApiKey(): string {
  return getCurrentTenant().notionApiKey;
}

async function notionRequest(method: string, path: string, payload?: object): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NOTION_API_KEY 未設定');
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    let res: Response;
    try {
      res = await fetch(`${NOTION_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_API_VERSION,
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      // タイムアウト/ネットワーク断も一時障害として次の試行へ
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
    if (res.ok) return res.json();
    const text = await res.text();
    const err = new Error(`Notion API ${res.status}: ${text.slice(0, 300)}`);
    if (!NOTION_RETRYABLE_STATUS.has(res.status)) throw err;
    lastError = err;
  }
  throw lastError ?? new Error('Notion request failed');
}

function pageToLog(page: { id: string; created_time: string; properties: Record<string, any> }): WeightLog {
  const p = page.properties;
  return {
    id: page.id,
    lineUserId: p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '',
    customerName: p['顧客名']?.rich_text?.[0]?.plain_text || '',
    date: p['日付']?.title?.[0]?.plain_text || '',
    weightKg: p['体重(kg)']?.number ?? 0,
    memo: p['メモ']?.rich_text?.[0]?.plain_text || '',
    source: p['入力経路']?.select?.name || '',
    createdAt: page.created_time,
  };
}

export async function createWeightLog(input: {
  lineUserId: string;
  customerName: string;
  date: string;
  weightKg: number;
  memo?: string;
  source?: string;
}): Promise<WeightLog> {
  const dbId = getWeightDbId();
  if (!dbId) throw new Error('Notion 体重DB ID 未設定');

  const existing = await getWeightOnDate(input.lineUserId, input.date);
  if (existing) {
    const properties: Record<string, unknown> = {
      '体重(kg)': { number: input.weightKg },
    };
    if (input.memo !== undefined) {
      properties['メモ'] = input.memo
        ? { rich_text: [{ text: { content: input.memo } }] }
        : { rich_text: [] };
    }
    await notionRequest('PATCH', `/pages/${existing.id}`, { properties });
    return { ...existing, weightKg: input.weightKg, memo: input.memo ?? existing.memo };
  }

  const properties: Record<string, unknown> = {
    日付: { title: [{ text: { content: input.date } }] },
    '体重(kg)': { number: input.weightKg },
    LINEユーザーID: { rich_text: [{ text: { content: input.lineUserId } }] },
    顧客名: { rich_text: [{ text: { content: input.customerName } }] },
    入力経路: { select: { name: input.source ?? 'LIFF' } },
  };
  if (input.memo) {
    properties['メモ'] = { rich_text: [{ text: { content: input.memo } }] };
  }
  const page = await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties,
  });
  return pageToLog(page);
}

export async function listWeightLogsByLineUser(
  lineUserId: string,
  startDate?: string,
  endDate?: string
): Promise<WeightLog[]> {
  const dbId = getWeightDbId();
  if (!dbId) return [];

  // 体重DBの「日付」は Notion の title 型のため、date 型用の範囲フィルタ
  // (on_or_after / on_or_before) が使えない。lineUserId のみで全件取得し、
  // 日付範囲は JS 側で絞り込む（体重ログは1顧客あたり最大でも数百件程度）。
  const results: WeightLog[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
      sorts: [{ property: '日付', direction: 'descending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest('POST', `/databases/${dbId}/query`, body);
    for (const page of res.results || []) {
      results.push(pageToLog(page));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  // 「日付」は YYYY-MM-DD 文字列なので文字列比較で範囲フィルタ可能
  if (!startDate && !endDate) return results;
  return results.filter((w) => {
    if (startDate && (!w.date || w.date < startDate)) return false;
    if (endDate && (!w.date || w.date > endDate)) return false;
    return true;
  });
}

export async function getLatestWeight(lineUserId: string): Promise<WeightLog | null> {
  const dbId = getWeightDbId();
  if (!dbId) return null;
  const res = await notionRequest('POST', `/databases/${dbId}/query`, {
    filter: { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
    sorts: [{ property: '日付', direction: 'descending' }],
    page_size: 1,
  });
  const results = res.results || [];
  if (results.length === 0) return null;
  return pageToLog(results[0]);
}

export async function getWeightOnDate(lineUserId: string, date: string): Promise<WeightLog | null> {
  const dbId = getWeightDbId();
  if (!dbId) return null;
  const res = await notionRequest('POST', `/databases/${dbId}/query`, {
    filter: {
      and: [
        { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
        { property: '日付', title: { equals: date } },
      ],
    },
    page_size: 1,
  });
  const results = res.results || [];
  if (results.length === 0) return null;
  return pageToLog(results[0]);
}

export async function deleteWeightLog(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}
