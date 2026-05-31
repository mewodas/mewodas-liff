import { getCurrentTenant } from '@/lib/tenant';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

export type BodyCompositionLog = {
  id: string;
  lineUserId: string;
  customerName: string;
  measureDate: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  bodyFatMassKg: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
  basalMetabolicKcal: number | null;
  visceralFatLevel: number | null;
  skeletalMuscleMassKg: number | null;
  rightArmMuscleKg: number | null;
  leftArmMuscleKg: number | null;
  rightLegMuscleKg: number | null;
  leftLegMuscleKg: number | null;
  trunkMuscleKg: number | null;
  device: string | null;
  memo: string;
  registeredBy: string;
  createdAt: string;
};

function getBodyCompDbId(): string {
  return getCurrentTenant().notionBodyCompDbId || '';
}

function getApiKey(): string {
  return getCurrentTenant().notionApiKey;
}

async function notionRequest(method: string, path: string, payload?: object): Promise<any> {
  const apiKey = getApiKey();
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

function pageToLog(page: { id: string; created_time: string; properties: Record<string, any> }): BodyCompositionLog {
  const p = page.properties;
  return {
    id: page.id,
    lineUserId: p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '',
    customerName: p['顧客名']?.rich_text?.[0]?.plain_text || '',
    measureDate: p['計測日']?.title?.[0]?.plain_text || '',
    weightKg: p['体重(kg)']?.number ?? 0,
    bodyFatPct: p['体脂肪率(%)']?.number ?? 0,
    muscleMassKg: p['筋肉量(kg)']?.number ?? 0,
    bodyFatMassKg: p['体脂肪量(kg)']?.number ?? null,
    bodyWaterPct: p['体水分率(%)']?.number ?? null,
    bmi: p['BMI']?.number ?? null,
    basalMetabolicKcal: p['基礎代謝(kcal)']?.number ?? null,
    visceralFatLevel: p['内臓脂肪レベル']?.number ?? null,
    skeletalMuscleMassKg: p['骨格筋量(kg)']?.number ?? null,
    rightArmMuscleKg: p['右腕筋肉量(kg)']?.number ?? null,
    leftArmMuscleKg: p['左腕筋肉量(kg)']?.number ?? null,
    rightLegMuscleKg: p['右脚筋肉量(kg)']?.number ?? null,
    leftLegMuscleKg: p['左脚筋肉量(kg)']?.number ?? null,
    trunkMuscleKg: p['体幹筋肉量(kg)']?.number ?? null,
    device: p['測定機器']?.select?.name ?? null,
    memo: p['メモ']?.rich_text?.[0]?.plain_text || '',
    registeredBy: p['登録者']?.rich_text?.[0]?.plain_text || '',
    createdAt: page.created_time,
  };
}

function buildProperties(input: {
  lineUserId: string;
  customerName: string;
  measureDate: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  bodyFatMassKg?: number | null;
  bodyWaterPct?: number | null;
  bmi?: number | null;
  basalMetabolicKcal?: number | null;
  visceralFatLevel?: number | null;
  skeletalMuscleMassKg?: number | null;
  rightArmMuscleKg?: number | null;
  leftArmMuscleKg?: number | null;
  rightLegMuscleKg?: number | null;
  leftLegMuscleKg?: number | null;
  trunkMuscleKg?: number | null;
  device?: string | null;
  memo?: string;
  registeredBy?: string;
}, isCreate: boolean): Record<string, unknown> {
  const props: Record<string, unknown> = {
    '体重(kg)': { number: input.weightKg },
    '体脂肪率(%)': { number: input.bodyFatPct },
    '筋肉量(kg)': { number: input.muscleMassKg },
  };
  if (isCreate) {
    props['計測日'] = { title: [{ text: { content: input.measureDate } }] };
    props['LINEユーザーID'] = { rich_text: [{ text: { content: input.lineUserId } }] };
    props['顧客名'] = { rich_text: [{ text: { content: input.customerName } }] };
  }
  if (input.bodyFatMassKg !== undefined) props['体脂肪量(kg)'] = { number: input.bodyFatMassKg };
  if (input.bodyWaterPct !== undefined) props['体水分率(%)'] = { number: input.bodyWaterPct };
  if (input.bmi !== undefined) props['BMI'] = { number: input.bmi };
  if (input.basalMetabolicKcal !== undefined) props['基礎代謝(kcal)'] = { number: input.basalMetabolicKcal };
  if (input.visceralFatLevel !== undefined) props['内臓脂肪レベル'] = { number: input.visceralFatLevel };
  if (input.skeletalMuscleMassKg !== undefined) props['骨格筋量(kg)'] = { number: input.skeletalMuscleMassKg };
  if (input.rightArmMuscleKg !== undefined) props['右腕筋肉量(kg)'] = { number: input.rightArmMuscleKg };
  if (input.leftArmMuscleKg !== undefined) props['左腕筋肉量(kg)'] = { number: input.leftArmMuscleKg };
  if (input.rightLegMuscleKg !== undefined) props['右脚筋肉量(kg)'] = { number: input.rightLegMuscleKg };
  if (input.leftLegMuscleKg !== undefined) props['左脚筋肉量(kg)'] = { number: input.leftLegMuscleKg };
  if (input.trunkMuscleKg !== undefined) props['体幹筋肉量(kg)'] = { number: input.trunkMuscleKg };
  if (input.device !== undefined) {
    props['測定機器'] = input.device ? { select: { name: input.device } } : { select: null };
  }
  if (input.memo !== undefined) {
    props['メモ'] = input.memo ? { rich_text: [{ text: { content: input.memo } }] } : { rich_text: [] };
  }
  if (input.registeredBy !== undefined) {
    props['登録者'] = input.registeredBy ? { rich_text: [{ text: { content: input.registeredBy } }] } : { rich_text: [] };
  }
  return props;
}

export type CreateBodyCompositionInput = {
  lineUserId: string;
  customerName: string;
  measureDate: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  bodyFatMassKg?: number | null;
  bodyWaterPct?: number | null;
  bmi?: number | null;
  basalMetabolicKcal?: number | null;
  visceralFatLevel?: number | null;
  skeletalMuscleMassKg?: number | null;
  rightArmMuscleKg?: number | null;
  leftArmMuscleKg?: number | null;
  rightLegMuscleKg?: number | null;
  leftLegMuscleKg?: number | null;
  trunkMuscleKg?: number | null;
  device?: string | null;
  memo?: string;
  registeredBy?: string;
};

export async function createBodyCompositionLog(input: CreateBodyCompositionInput): Promise<BodyCompositionLog> {
  const dbId = getBodyCompDbId();
  if (!dbId) throw new Error('Notion 体組成DB ID 未設定');

  const existing = await getBodyCompositionOnDate(input.lineUserId, input.measureDate);
  if (existing) {
    const properties = buildProperties(input, false);
    const updated = await notionRequest('PATCH', `/pages/${existing.id}`, { properties });
    return pageToLog(updated);
  }

  const properties = buildProperties(input, true);
  const page = await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties,
  });
  return pageToLog(page);
}

// 既存レコードを ID 指定で上書き更新（編集用）。計測日(title)も含めて全項目を上書きするため、
// 計測日を変更しても新規複製されず元のレコードがそのまま更新される。
export async function updateBodyCompositionLog(
  id: string,
  input: CreateBodyCompositionInput
): Promise<BodyCompositionLog> {
  const properties = buildProperties(input, true);
  const page = await notionRequest('PATCH', `/pages/${id}`, { properties });
  return pageToLog(page);
}

export async function listBodyCompositionLogsByLineUser(
  lineUserId: string,
  startDate?: string,
  endDate?: string
): Promise<BodyCompositionLog[]> {
  const dbId = getBodyCompDbId();
  if (!dbId) return [];

  const results: BodyCompositionLog[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
      sorts: [{ property: '計測日', direction: 'descending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest('POST', `/databases/${dbId}/query`, body);
    for (const page of res.results || []) {
      results.push(pageToLog(page));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  if (!startDate && !endDate) return results;
  return results.filter((log) => {
    if (startDate && (!log.measureDate || log.measureDate < startDate)) return false;
    if (endDate && (!log.measureDate || log.measureDate > endDate)) return false;
    return true;
  });
}

export async function getBodyCompositionOnDate(lineUserId: string, measureDate: string): Promise<BodyCompositionLog | null> {
  const dbId = getBodyCompDbId();
  if (!dbId) return null;
  const res = await notionRequest('POST', `/databases/${dbId}/query`, {
    filter: {
      and: [
        { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
        { property: '計測日', title: { equals: measureDate } },
      ],
    },
    page_size: 1,
  });
  const results = res.results || [];
  if (results.length === 0) return null;
  return pageToLog(results[0]);
}

export async function deleteBodyCompositionLog(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}
