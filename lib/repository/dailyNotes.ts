import { getCurrentTenant } from '@/lib/tenant';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';
// Notion 一時障害（429/502/503/504）・ネットワーク断は指数バックオフで最大3回リトライ。
// （体重ログ repository と同方式。中央 lib/notion.ts のリトライと揃える）
const NOTION_RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

// Notion rich_text 1ブロックの上限（2000文字）。これを超える保存は API 側で弾く。
export const DAILY_NOTE_MAX_LENGTH = 2000;

export type DailyNote = {
  id: string;
  lineUserId: string;
  customerName: string;
  date: string;
  note: string;
  source: string;
  createdAt: string;
};

function getDailyNoteDbId(): string {
  return getCurrentTenant().notionDailyNoteDbId || '';
}

/** このテナントで日次備考機能が利用可能か（DB が割り当て済みか） */
export function isDailyNoteEnabled(): boolean {
  return !!getDailyNoteDbId();
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

function pageToNote(page: { id: string; created_time: string; properties: Record<string, any> }): DailyNote {
  const p = page.properties;
  return {
    id: page.id,
    lineUserId: p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '',
    customerName: p['顧客名']?.rich_text?.[0]?.plain_text || '',
    date: p['日付']?.title?.[0]?.plain_text || '',
    note: p['備考']?.rich_text?.[0]?.plain_text || '',
    source: p['入力経路']?.select?.name || '',
    createdAt: page.created_time,
  };
}

/** 指定ユーザー・指定日の備考を1件取得（無ければ null）。 */
export async function getDailyNoteOnDate(lineUserId: string, date: string): Promise<DailyNote | null> {
  const dbId = getDailyNoteDbId();
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
  return pageToNote(results[0]);
}

/**
 * 1日1ユーザー1レコードで備考を upsert する。
 * 既存があれば備考のみ更新（PATCH）、無ければ新規作成（POST）。
 * 空文字を渡すとその日の備考をクリアする。
 * 検索キーは LINEユーザーID（呼び出し元で検証済み）＋日付なので、他人の記録には触れない。
 */
export async function upsertDailyNote(input: {
  lineUserId: string;
  customerName?: string;
  date: string;
  note: string;
  source?: string;
}): Promise<DailyNote> {
  const dbId = getDailyNoteDbId();
  if (!dbId) throw new Error('Notion 日次備考DB ID 未設定');
  const note = input.note ?? '';

  const existing = await getDailyNoteOnDate(input.lineUserId, input.date);
  if (existing) {
    await notionRequest('PATCH', `/pages/${existing.id}`, {
      properties: {
        備考: note ? { rich_text: [{ text: { content: note } }] } : { rich_text: [] },
      },
    });
    return { ...existing, note };
  }

  const properties: Record<string, unknown> = {
    日付: { title: [{ text: { content: input.date } }] },
    LINEユーザーID: { rich_text: [{ text: { content: input.lineUserId } }] },
    入力経路: { select: { name: input.source ?? 'LIFF' } },
  };
  if (input.customerName) {
    properties['顧客名'] = { rich_text: [{ text: { content: input.customerName } }] };
  }
  if (note) {
    properties['備考'] = { rich_text: [{ text: { content: note } }] };
  }
  const page = await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties,
  });
  return pageToNote(page);
}
