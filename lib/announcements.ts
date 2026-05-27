// FitMeal 運営からの全テナント共通お知らせ（broadcast announcements）
//
// 必要な環境変数: NOTION_ANNOUNCEMENTS_DB_ID
//
// Notion DB スキーマ:
//   - タイトル (title)
//   - 本文 (rich_text)
//   - 公開日 (date)
//   - 公開終了日 (date, 任意)
//   - 公開ステータス (select) "下書き" / "公開" / "アーカイブ"
//   - 重要度 (select) "通常" / "重要"
//   - 対象テナント (multi_select) tenant_id を選択。空＝全テナント共通
//   - ピン留め (checkbox)
//
// per-user の通知（前日レポート等）は lib/notifications.ts。
// このモジュールは「全テナント or 特定テナント向けの放送告知」を扱う。

import { getCurrentTenant } from '@/lib/tenant';
import { getCached, setCached } from '@/lib/cache';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

export type AnnouncementImportance = '通常' | '重要';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  importance: AnnouncementImportance;
  pinned: boolean;
  publishedAt: string | null;
  publishUntil: string | null;
  targetTenants: string[]; // 空配列＝全テナント共通
};

const NOTION_DB_ID_RE = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDbId(): string | null {
  const raw = process.env.NOTION_ANNOUNCEMENTS_DB_ID;
  if (!raw) return null;
  const v = raw.trim();
  if (!NOTION_DB_ID_RE.test(v)) {
    console.warn(`[announcements] NOTION_ANNOUNCEMENTS_DB_ID is not a valid Notion DB ID: "${v}"`);
    return null;
  }
  return v;
}

export function isAnnouncementsConfigured(): boolean {
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
function pageToAnnouncement(page: { id: string; properties: Record<string, any> }): Announcement {
  const p = page.properties;
  return {
    id: page.id,
    title: p['タイトル']?.title?.[0]?.plain_text || '',
    body:
      p['本文']?.rich_text?.map((rt: { plain_text: string }) => rt.plain_text).join('') || '',
    importance: (p['重要度']?.select?.name as AnnouncementImportance) || '通常',
    pinned: !!p['ピン留め']?.checkbox,
    publishedAt: p['公開日']?.date?.start || null,
    publishUntil: p['公開終了日']?.date?.start || null,
    targetTenants:
      (p['対象テナント']?.multi_select || []).map((t: { name: string }) => t.name) || [],
  };
}

/**
 * 現在テナント向けに表示すべきお知らせを取得。
 * - 公開ステータス="公開"
 * - 公開日<=今日（または未設定）
 * - 公開終了日>=今日（または未設定）
 * - 対象テナント=空 または tenantId を含む
 * - ピン留めは先頭、その後は公開日降順
 */
export async function listAnnouncementsForTenant(tenantId: string): Promise<Announcement[]> {
  const dbId = getDbId();
  if (!dbId) return [];

  const cacheKey = `${tenantId}:announcements`;
  const hit = getCached<Announcement[]>(cacheKey);
  if (hit) return hit;

  // Notion 側で複雑フィルタを書くのも可だが、列挙して JS で絞った方が変更に強い
  const res = (await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 50,
    sorts: [{ property: '公開日', direction: 'descending' }],
    filter: {
      property: '公開ステータス',
      select: { equals: '公開' },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as { results?: Array<{ id: string; properties: Record<string, any> }> };

  const today = new Date().toISOString().slice(0, 10);
  const all = (res.results || []).map(pageToAnnouncement);
  const filtered = all.filter((a) => {
    if (a.publishedAt && a.publishedAt > today) return false;
    if (a.publishUntil && a.publishUntil < today) return false;
    if (a.targetTenants.length > 0 && !a.targetTenants.includes(tenantId)) return false;
    return true;
  });

  // ピン留めを最上部、続いて公開日降順
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aDate = a.publishedAt || '';
    const bDate = b.publishedAt || '';
    return bDate.localeCompare(aDate);
  });

  setCached(cacheKey, filtered, 60_000);
  return filtered;
}

/** 現在テナントを内部で解決して呼ぶラッパー */
export async function listAnnouncements(): Promise<Announcement[]> {
  let tenantId = 'mewodas';
  try {
    tenantId = getCurrentTenant().id;
  } catch {
    // フォールバック
  }
  return listAnnouncementsForTenant(tenantId);
}

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const dbId = getDbId();
  if (!dbId) return null;
  try {
    const page = (await notionRequest('GET', `/pages/${id}`)) as {
      id: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: Record<string, any>;
    };
    return pageToAnnouncement(page);
  } catch (e) {
    console.error('[announcements] getAnnouncementById failed:', e);
    return null;
  }
}
