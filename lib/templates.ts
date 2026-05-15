// レポートテンプレート管理（Notion）
// 必要環境変数: NOTION_TEMPLATES_DB_ID
// スキーマ:
//   - 名前 (title)              ：表示用テンプレート名 例「前日レポート」
//   - カテゴリ (select)         ：前日レポート / 週次レポート / カスタム
//   - タイトル雛形 (rich_text)  ：送信時のタイトル雛形（変数 {date}, {customer} 可）
//   - 本文雛形 (rich_text)      ：固定本文（AI生成オフ時はこれをそのまま送信）
//   - AI生成 (checkbox)         ：true=AIで本文を自動生成、false=固定本文を使用
//   - AIプロンプト (rich_text)  ：AI生成時の追加指示

import { getTenantNotion } from '@/lib/notion';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

export type RangeType = '昨日' | '今日' | '先週' | '今週' | '先月' | '今月' | 'カスタム';

export type ReportTemplate = {
  id: string;
  name: string;
  category: '前日レポート' | '週次レポート' | 'カスタム' | string;
  titleTemplate: string;
  bodyTemplate: string;
  useAi: boolean;
  aiPrompt: string;
  rangeType?: RangeType;
};

function getDbId(): string | null {
  return process.env.NOTION_TEMPLATES_DB_ID || 'cdcfe37b69714617be8628c81563920a';
}

export function isTemplatesConfigured(): boolean {
  return !!getDbId();
}

async function notionRequest(method: string, path: string, body?: object): Promise<any> {
  const apiKey = getTenantNotion().apiKey;
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

const RANGE_TYPES: RangeType[] = ['昨日', '今日', '先週', '今週', '先月', '今月', 'カスタム'];

function toRangeType(v: string | undefined): RangeType | undefined {
  if (!v) return undefined;
  return RANGE_TYPES.includes(v as RangeType) ? (v as RangeType) : undefined;
}

function pageToTemplate(page: { id: string; properties: Record<string, any> }): ReportTemplate {
  const p = page.properties;
  const richJoin = (key: string) =>
    (p[key]?.rich_text || []).map((rt: { plain_text: string }) => rt.plain_text).join('');
  return {
    id: page.id,
    name: p['名前']?.title?.[0]?.plain_text || '',
    category: p['カテゴリ']?.select?.name || 'カスタム',
    titleTemplate: richJoin('タイトル雛形'),
    bodyTemplate: richJoin('本文雛形'),
    useAi: !!p['AI生成']?.checkbox,
    aiPrompt: richJoin('AIプロンプト'),
    rangeType: toRangeType(p['対象期間']?.select?.name),
  };
}

function richText(s: string) {
  const chunks: string[] = [];
  let rest = s || '';
  while (rest.length > 0) {
    chunks.push(rest.slice(0, 1800));
    rest = rest.slice(1800);
  }
  if (chunks.length === 0) chunks.push('');
  return chunks.map((c) => ({ text: { content: c } }));
}

export async function listTemplates(): Promise<ReportTemplate[]> {
  const dbId = getDbId();
  if (!dbId) return [];
  const res = await notionRequest('POST', `/databases/${dbId}/query`, { page_size: 100 });
  return (res.results || []).map(pageToTemplate);
}

export async function getTemplate(id: string): Promise<ReportTemplate | null> {
  if (!getDbId()) return null;
  try {
    const res = await notionRequest('GET', `/pages/${id}`);
    return pageToTemplate(res);
  } catch {
    return null;
  }
}

export async function createTemplate(params: {
  name: string;
  category: string;
  titleTemplate: string;
  bodyTemplate: string;
  useAi: boolean;
  aiPrompt: string;
  rangeType?: RangeType;
}): Promise<ReportTemplate> {
  const dbId = getDbId();
  if (!dbId) throw new Error('NOTION_TEMPLATES_DB_ID 未設定');
  const properties: Record<string, unknown> = {
    名前: { title: [{ text: { content: params.name.slice(0, 100) } }] },
    カテゴリ: { select: { name: params.category } },
    タイトル雛形: { rich_text: richText(params.titleTemplate) },
    本文雛形: { rich_text: richText(params.bodyTemplate) },
    AI生成: { checkbox: !!params.useAi },
    AIプロンプト: { rich_text: richText(params.aiPrompt) },
  };
  if (params.rangeType) properties['対象期間'] = { select: { name: params.rangeType } };
  const res = await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties,
  });
  return pageToTemplate(res);
}

export async function updateTemplate(
  id: string,
  patch: Partial<{ name: string; category: string; titleTemplate: string; bodyTemplate: string; useAi: boolean; aiPrompt: string; rangeType: RangeType | null }>
): Promise<void> {
  if (!getDbId()) throw new Error('NOTION_TEMPLATES_DB_ID 未設定');
  const properties: Record<string, unknown> = {};
  if (patch.name !== undefined) properties['名前'] = { title: [{ text: { content: patch.name.slice(0, 100) } }] };
  if (patch.category !== undefined) properties['カテゴリ'] = { select: { name: patch.category } };
  if (patch.titleTemplate !== undefined) properties['タイトル雛形'] = { rich_text: richText(patch.titleTemplate) };
  if (patch.bodyTemplate !== undefined) properties['本文雛形'] = { rich_text: richText(patch.bodyTemplate) };
  if (patch.useAi !== undefined) properties['AI生成'] = { checkbox: !!patch.useAi };
  if (patch.aiPrompt !== undefined) properties['AIプロンプト'] = { rich_text: richText(patch.aiPrompt) };
  if (patch.rangeType !== undefined) {
    properties['対象期間'] = patch.rangeType ? { select: { name: patch.rangeType } } : { select: null };
  }
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${id}`, { properties });
}

export async function deleteTemplate(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}

// 初期テンプレ（DB未設定時のフォールバック・参考用）
export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'default-daily',
    name: '前日レポート（AI生成）',
    category: '前日レポート',
    titleTemplate: '{date}の振り返りレポート',
    bodyTemplate: '',
    useAi: true,
    aiPrompt:
      '昨日の食事・運動・体重から、達成度・良かった点・改善点・今日のアドバイスを5-8行で。具体的な数字と食事名を含めて、敬体で。',
  },
  {
    id: 'default-weekly',
    name: '週次レポート（AI生成）',
    category: '週次レポート',
    titleTemplate: '週次レポート（{startDate}〜{endDate}）',
    bodyTemplate: '',
    useAi: true,
    aiPrompt:
      '1週間の振り返り。記録継続率・PFCバランス・体重推移・運動頻度を踏まえ、ハイライト・課題・来週のアクションを6-10行で。具体数字を入れて敬体で。',
  },
];
