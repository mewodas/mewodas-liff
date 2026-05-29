// 定期レポート配信ルール管理（Notion）
//
// 必要な環境変数: SCHEDULED_REPORTS_DB_ID
//
// Notion DB スキーマ（全テナント共有・tenant_id列で分離）:
//   - ルール名 (title)
//   - テナントID (rich_text)
//   - テンプレ名 (rich_text)
//   - 宛先 (select): 全顧客 / 店舗
//   - 対象店舗ID (rich_text)
//   - 頻度 (select): 毎日 / 毎週 / 毎月
//   - 曜日 (multi_select): 日/月/火/水/木/金/土
//   - 日 (number): 1〜31
//   - 時刻 (rich_text): "HH:MM"
//   - アプリ内保存 (checkbox)
//   - LINE送信 (checkbox)
//   - 有効 (checkbox)

import { getCached, setCached, invalidate } from '@/lib/cache';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

export type ScheduledReportAudience = '全顧客' | '店舗';
export type ScheduledReportFrequency = '毎日' | '毎週' | '毎月';

export type ScheduledReportRule = {
  id: string;
  tenantId: string;
  name: string;
  templateName: string;
  audience: ScheduledReportAudience;
  targetStoreId: string | null;
  frequency: ScheduledReportFrequency;
  weekdays: string[];
  dayOfMonth: number | null;
  time: string;
  saveInApp: boolean;
  sendLine: boolean;
  enabled: boolean;
};

const NOTION_DB_ID_RE =
  /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDbId(): string | null {
  const raw = process.env.SCHEDULED_REPORTS_DB_ID;
  if (!raw) return null;
  const v = raw.trim();
  if (!NOTION_DB_ID_RE.test(v)) {
    console.warn(`[scheduledReports] SCHEDULED_REPORTS_DB_ID is not a valid Notion DB ID: "${v}"`);
    return null;
  }
  return v;
}

export function isScheduledReportsConfigured(): boolean {
  return !!getDbId();
}

async function notionRequest(method: string, path: string, body?: object): Promise<unknown> {
  const apiKey = process.env.NOTION_API_KEY || '';
  if (!apiKey) throw new Error('NOTION_API_KEY 未設定');
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToRule(page: { id: string; properties: Record<string, any> }): ScheduledReportRule {
  const p = page.properties;
  const richText = (key: string): string =>
    (p[key]?.rich_text || []).map((rt: { plain_text: string }) => rt.plain_text).join('') || '';
  const weekdays: string[] =
    (p['曜日']?.multi_select || []).map((s: { name: string }) => s.name) || [];
  const dayNum: number | null =
    typeof p['日']?.number === 'number' ? p['日'].number : null;
  return {
    id: page.id,
    tenantId: richText('テナントID'),
    name: p['ルール名']?.title?.[0]?.plain_text || '',
    templateName: richText('テンプレ名'),
    audience: (p['宛先']?.select?.name as ScheduledReportAudience) || '全顧客',
    targetStoreId: richText('対象店舗ID') || null,
    frequency: (p['頻度']?.select?.name as ScheduledReportFrequency) || '毎日',
    weekdays,
    dayOfMonth: dayNum,
    time: richText('時刻') || '06:00',
    saveInApp: !!p['アプリ内保存']?.checkbox,
    sendLine: !!p['LINE送信']?.checkbox,
    enabled: !!p['有効']?.checkbox,
  };
}

function richText(s: string): { text: { content: string } }[] {
  const chunks: string[] = [];
  let rest = s;
  while (rest.length > 0) {
    chunks.push(rest.slice(0, 1800));
    rest = rest.slice(1800);
  }
  if (chunks.length === 0) chunks.push('');
  return chunks.map((c) => ({ text: { content: c } }));
}

export async function listRulesForTenant(tenantId: string): Promise<ScheduledReportRule[]> {
  const dbId = getDbId();
  if (!dbId) return [];

  const cacheKey = `scheduled_reports:${tenantId}`;
  const hit = getCached<ScheduledReportRule[]>(cacheKey);
  if (hit) return hit;

  const res = (await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 100,
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
    filter: {
      and: [
        { property: 'テナントID', rich_text: { equals: tenantId } },
        { property: 'ルール名', title: { is_not_empty: true } },
      ],
    },
  })) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: Array<{ id: string; properties: Record<string, any> }>;
  };

  const rules = (res.results || []).map(pageToRule);
  setCached(cacheKey, rules, 60_000);
  return rules;
}

export async function listAllRules(): Promise<ScheduledReportRule[]> {
  const dbId = getDbId();
  if (!dbId) return [];

  const cacheKey = 'scheduled_reports:all';
  const hit = getCached<ScheduledReportRule[]>(cacheKey);
  if (hit) return hit;

  const res = (await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 100,
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
    filter: {
      property: '有効',
      checkbox: { equals: true },
    },
  })) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: Array<{ id: string; properties: Record<string, any> }>;
  };

  const rules = (res.results || []).map(pageToRule);
  setCached(cacheKey, rules, 60_000);
  return rules;
}

export type CreateScheduledReportRuleParams = {
  tenantId: string;
  name: string;
  templateName: string;
  audience: ScheduledReportAudience;
  targetStoreId?: string | null;
  frequency: ScheduledReportFrequency;
  weekdays?: string[];
  dayOfMonth?: number | null;
  time: string;
  saveInApp: boolean;
  sendLine: boolean;
  enabled?: boolean;
};

export async function createRule(
  params: CreateScheduledReportRuleParams
): Promise<ScheduledReportRule> {
  const dbId = getDbId();
  if (!dbId) throw new Error('SCHEDULED_REPORTS_DB_ID 未設定');

  const props: Record<string, unknown> = {
    ルール名: { title: [{ text: { content: params.name.slice(0, 200) } }] },
    テナントID: { rich_text: richText(params.tenantId) },
    テンプレ名: { rich_text: richText(params.templateName) },
    宛先: { select: { name: params.audience } },
    頻度: { select: { name: params.frequency } },
    時刻: { rich_text: richText(params.time) },
    アプリ内保存: { checkbox: params.saveInApp },
    LINE送信: { checkbox: params.sendLine },
    有効: { checkbox: params.enabled !== false },
  };

  if (params.targetStoreId) {
    props['対象店舗ID'] = { rich_text: richText(params.targetStoreId) };
  }
  if (params.weekdays && params.weekdays.length > 0) {
    props['曜日'] = { multi_select: params.weekdays.map((name) => ({ name })) };
  }
  if (typeof params.dayOfMonth === 'number') {
    props['日'] = { number: params.dayOfMonth };
  }

  const page = (await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties: props,
  })) as { id: string; properties: Record<string, unknown> };

  invalidate('scheduled_reports:');
  return pageToRule(page as { id: string; properties: Record<string, never> });
}

export type UpdateScheduledReportRuleParams = Partial<{
  name: string;
  templateName: string;
  audience: ScheduledReportAudience;
  targetStoreId: string | null;
  frequency: ScheduledReportFrequency;
  weekdays: string[];
  dayOfMonth: number | null;
  time: string;
  saveInApp: boolean;
  sendLine: boolean;
  enabled: boolean;
}>;

export async function updateRule(
  id: string,
  patch: UpdateScheduledReportRuleParams
): Promise<ScheduledReportRule> {
  const props: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    props['ルール名'] = { title: [{ text: { content: patch.name.slice(0, 200) } }] };
  }
  if (patch.templateName !== undefined) {
    props['テンプレ名'] = { rich_text: richText(patch.templateName) };
  }
  if (patch.audience !== undefined) {
    props['宛先'] = { select: { name: patch.audience } };
  }
  if (patch.targetStoreId !== undefined) {
    props['対象店舗ID'] = { rich_text: patch.targetStoreId ? richText(patch.targetStoreId) : [] };
  }
  if (patch.frequency !== undefined) {
    props['頻度'] = { select: { name: patch.frequency } };
  }
  if (patch.weekdays !== undefined) {
    props['曜日'] = { multi_select: patch.weekdays.map((name) => ({ name })) };
  }
  if (patch.dayOfMonth !== undefined) {
    props['日'] = patch.dayOfMonth !== null ? { number: patch.dayOfMonth } : { number: null };
  }
  if (patch.time !== undefined) {
    props['時刻'] = { rich_text: richText(patch.time) };
  }
  if (patch.saveInApp !== undefined) {
    props['アプリ内保存'] = { checkbox: patch.saveInApp };
  }
  if (patch.sendLine !== undefined) {
    props['LINE送信'] = { checkbox: patch.sendLine };
  }
  if (patch.enabled !== undefined) {
    props['有効'] = { checkbox: patch.enabled };
  }

  const page = (await notionRequest('PATCH', `/pages/${id}`, { properties: props })) as {
    id: string;
    properties: Record<string, unknown>;
  };

  invalidate('scheduled_reports:');
  return pageToRule(page as { id: string; properties: Record<string, never> });
}

export async function deleteRule(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
  invalidate('scheduled_reports:');
}
