// スタッフ管理（Notion）
// 必要環境変数: NOTION_STAFF_DB_ID
// スキーマ:
//   - 名前 (title)
//   - 店舗 (rich_text)
//   - 役職 (rich_text) [任意]
//   - 有効 (checkbox)

import { getTenantNotion } from '@/lib/notion';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2025-09-03';

export type Staff = {
  id: string;
  name: string;
  shop: string;
  role: string;
  active: boolean;
};

function getDbId(): string | null {
  return process.env.NOTION_STAFF_DB_ID || null;
}

export function isStaffConfigured(): boolean {
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

function pageToStaff(page: { id: string; properties: Record<string, any> }): Staff {
  const p = page.properties;
  return {
    id: page.id,
    name: p['名前']?.title?.[0]?.plain_text || '',
    shop: p['店舗']?.rich_text?.[0]?.plain_text || '',
    role: p['役職']?.rich_text?.[0]?.plain_text || '',
    active: p['有効']?.checkbox !== false, // 既定 true
  };
}

export async function listStaff(): Promise<Staff[]> {
  const dbId = getDbId();
  if (!dbId) return [];
  const res = await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 100,
  });
  return (res.results || []).map(pageToStaff).filter((s: Staff) => s.active);
}

export async function getStaff(id: string): Promise<Staff | null> {
  if (!getDbId()) return null;
  try {
    const res = await notionRequest('GET', `/pages/${id}`);
    return pageToStaff(res);
  } catch {
    return null;
  }
}

export async function createStaff(params: { name: string; shop: string; role?: string }): Promise<Staff> {
  const dbId = getDbId();
  if (!dbId) throw new Error('NOTION_STAFF_DB_ID 未設定');
  const res = await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties: {
      名前: { title: [{ text: { content: params.name.slice(0, 100) } }] },
      店舗: { rich_text: [{ text: { content: (params.shop || '').slice(0, 100) } }] },
      役職: { rich_text: [{ text: { content: (params.role || '').slice(0, 100) } }] },
      有効: { checkbox: true },
    },
  });
  return pageToStaff(res);
}

export async function updateStaff(
  id: string,
  patch: { name?: string; shop?: string; role?: string; active?: boolean }
): Promise<void> {
  if (!getDbId()) throw new Error('NOTION_STAFF_DB_ID 未設定');
  const properties: Record<string, unknown> = {};
  if (patch.name !== undefined) properties['名前'] = { title: [{ text: { content: patch.name.slice(0, 100) } }] };
  if (patch.shop !== undefined) properties['店舗'] = { rich_text: [{ text: { content: patch.shop.slice(0, 100) } }] };
  if (patch.role !== undefined) properties['役職'] = { rich_text: [{ text: { content: patch.role.slice(0, 100) } }] };
  if (patch.active !== undefined) properties['有効'] = { checkbox: patch.active };
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${id}`, { properties });
}

export async function deleteStaff(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}
