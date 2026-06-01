import { getCurrentTenant } from '@/lib/tenant';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';
// Notion 一時障害（429/502/503/504）・ネットワーク断は指数バックオフで最大3回リトライ。
// （中央 lib/notion.ts と同方式。この repo は自前 notionRequest のためリトライが無く、
//   運動記録の保存が一時エラーで間欠的に失敗していた）
const NOTION_RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export type ExerciseLog = {
  id: string;
  lineUserId: string;
  customerName: string;
  date: string;
  exercise: string;
  category: string;
  durationMin: number;
  intensity: string;
  estimatedKcal: number;
  memo: string;
  createdAt: string;
};

function getExerciseDbId(): string {
  return process.env.NOTION_EXERCISE_DB_ID || '';
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

function pageToLog(page: { id: string; created_time: string; properties: Record<string, any> }): ExerciseLog {
  const p = page.properties;
  return {
    id: page.id,
    lineUserId: p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '',
    customerName: p['顧客名']?.rich_text?.[0]?.plain_text || '',
    date: p['日付']?.date?.start || '',
    exercise: p['種目']?.title?.[0]?.plain_text || '',
    category: p['種目カテゴリ']?.select?.name || '',
    durationMin: p['時間_分']?.number || 0,
    intensity: p['強度']?.select?.name || '',
    estimatedKcal: p['推定消費kcal']?.number || 0,
    memo: p['メモ']?.rich_text?.[0]?.plain_text || '',
    createdAt: page.created_time,
  };
}

export async function createExerciseLog(input: {
  lineUserId: string;
  customerName: string;
  date: string;
  exercise: string;
  category: string;
  durationMin: number;
  intensity: string;
  estimatedKcal: number;
  memo: string;
}): Promise<ExerciseLog> {
  const dbId = getExerciseDbId();
  if (!dbId) throw new Error('NOTION_EXERCISE_DB_ID 未設定');
  const properties: Record<string, unknown> = {
    種目: { title: [{ text: { content: input.exercise } }] },
    日付: { date: { start: input.date } },
    LINEユーザーID: { rich_text: [{ text: { content: input.lineUserId } }] },
    顧客名: { rich_text: [{ text: { content: input.customerName } }] },
    時間_分: { number: input.durationMin },
    強度: { select: { name: input.intensity } },
    推定消費kcal: { number: input.estimatedKcal },
    種目カテゴリ: { select: { name: input.category } },
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

export async function listExerciseLogsByLineUser(
  lineUserId: string,
  startDate?: string,
  endDate?: string
): Promise<ExerciseLog[]> {
  const dbId = getExerciseDbId();
  if (!dbId) return [];
  const filter: Record<string, unknown> = {
    and: [
      { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
    ],
  };
  if (startDate) {
    (filter.and as unknown[]).push({ property: '日付', date: { on_or_after: startDate } });
  }
  if (endDate) {
    (filter.and as unknown[]).push({ property: '日付', date: { on_or_before: endDate } });
  }
  const pages: ExerciseLog[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter,
      sorts: [{ property: '日付', direction: 'descending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest('POST', `/databases/${dbId}/query`, body);
    for (const page of res.results || []) {
      pages.push(pageToLog(page));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

export async function deleteExerciseLog(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}
