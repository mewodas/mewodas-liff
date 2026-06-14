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
    // 種目は改行を含み得る（ホーム「運動した」の複数項目は \n 結合）。
    // 全 rich_text セグメントを連結して取りこぼさない。
    exercise: (p['種目']?.title || [])
      .map((t: { plain_text?: string }) => t.plain_text || '')
      .join('') || '',
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
    推定消費kcal: { number: input.estimatedKcal },
  };
  // 強度・種目カテゴリは select 型のため空文字だと Notion がエラーになる。
  // ホームの「運動した」簡易記録（強度・カテゴリ無し）でも作成できるよう、値があるときだけ設定。
  if (input.intensity) properties['強度'] = { select: { name: input.intensity } };
  if (input.category) properties['種目カテゴリ'] = { select: { name: input.category } };
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

// ホームの「運動した」簡易レコードの判定: 時間0・カテゴリ無し・強度無し
function isSimpleExerciseLog(e: ExerciseLog): boolean {
  return e.durationMin === 0 && !e.category && !e.intensity;
}

/**
 * 当日の運動状態（ホーム読み戻し用）。/api/extras が getWeightOnDate と並んで使う。
 * 簡易（ホーム）レコードがあればその内容、無ければ詳細ログの種目を改行結合して返す。
 */
export async function getExerciseOnDate(
  lineUserId: string,
  date: string
): Promise<{ exercised: boolean; content: string }> {
  const logs = await listExerciseLogsByLineUser(lineUserId, date, date);
  if (logs.length === 0) return { exercised: false, content: '' };
  const simple = logs.find(isSimpleExerciseLog);
  const content = simple
    ? simple.exercise === '運動'
      ? '' // 内容無しのプレースホルダ
      : simple.exercise
    : logs.map((l) => l.exercise).filter(Boolean).join('\n');
  return { exercised: true, content };
}

/**
 * ホームの「運動した/しない」トグルを運動ログDB（真実のソース）に反映する。
 * - exercised=true: 当日の簡易レコード（時間0・カテゴリ/強度なし）を最新内容で作り直す。
 *   既に詳細ログがある日は簡易レコードを作らない（その日は既に運動済み扱い・重複防止）。
 * - exercised=false: 当日の簡易レコードのみアーカイブ（詳細ログは残す）。
 */
export async function setExerciseFlagOnDate(input: {
  lineUserId: string;
  customerName: string;
  date: string;
  exercised: boolean;
  content?: string;
}): Promise<void> {
  const dbId = getExerciseDbId();
  if (!dbId) throw new Error('NOTION_EXERCISE_DB_ID 未設定');
  const sameDay = await listExerciseLogsByLineUser(input.lineUserId, input.date, input.date);
  const simple = sameDay.filter(isSimpleExerciseLog);
  const hasDetailed = sameDay.some((e) => !isSimpleExerciseLog(e));

  // 既存の簡易レコードはいったん撤去（最新内容で作り直す / オフ化）
  for (const r of simple) await deleteExerciseLog(r.id);

  if (input.exercised && !hasDetailed) {
    await createExerciseLog({
      lineUserId: input.lineUserId,
      customerName: input.customerName,
      date: input.date,
      exercise: input.content?.trim() || '運動',
      category: '',
      durationMin: 0,
      intensity: '',
      estimatedKcal: 0,
      memo: '',
    });
  }
}

export async function deleteExerciseLog(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}
