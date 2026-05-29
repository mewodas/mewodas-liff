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
import { getCached, setCached, invalidate } from '@/lib/cache';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

export type AnnouncementImportance = '通常' | '重要';
export type AnnouncementAudience = '顧客向け' | '店舗向け';
export type AnnouncementStatus = '下書き' | '公開' | 'アーカイブ';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  importance: AnnouncementImportance;
  audience: AnnouncementAudience;
  pinned: boolean;
  createdAt: string;
  publishedAt: string | null;
  publishUntil: string | null;
  status: AnnouncementStatus;
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
function pageToAnnouncement(page: { id: string; created_time?: string; properties: Record<string, any> }): Announcement {
  const p = page.properties;
  return {
    id: page.id,
    title: p['タイトル']?.title?.[0]?.plain_text || '',
    body:
      p['本文']?.rich_text?.map((rt: { plain_text: string }) => rt.plain_text).join('') || '',
    importance: (p['重要度']?.select?.name as AnnouncementImportance) || '通常',
    // 宛先種別: 未設定（旧データ互換）は '顧客向け' をデフォルトにする
    audience: (p['宛先種別']?.select?.name as AnnouncementAudience) || '顧客向け',
    pinned: !!p['ピン留め']?.checkbox,
    createdAt: page.created_time || '',
    publishedAt: p['公開日']?.date?.start || null,
    publishUntil: p['公開終了日']?.date?.start || null,
    status: (p['公開ステータス']?.select?.name as AnnouncementStatus) || '公開',
    targetTenants:
      (p['対象テナント']?.multi_select || []).map((t: { name: string }) => t.name) || [],
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

  // お知らせは全テナント共有DB。キャッシュキーは閲覧側テナント単位だが、
  // 作成時に全テナントぶんを一括 invalidate できるよう `announcements:` 接頭辞で揃える。
  const cacheKey = `announcements:${tenantId}`;
  const hit = getCached<Announcement[]>(cacheKey);
  if (hit) return hit;

  // Notion 側で複雑フィルタを書くのも可だが、列挙して JS で絞った方が変更に強い
  const res = (await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 50,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    filter: {
      property: '公開ステータス',
      select: { equals: '公開' },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as { results?: Array<{ id: string; created_time?: string; properties: Record<string, any> }> };

  const today = new Date().toISOString().slice(0, 10);
  const all = (res.results || []).map(pageToAnnouncement);
  const filtered = all.filter((a) => {
    // 店舗向けお知らせは顧客LIFFに表示しない
    if (a.audience === '店舗向け') return false;
    if (a.publishedAt && a.publishedAt > today) return false;
    if (a.publishUntil && a.publishUntil < today) return false;
    if (a.targetTenants.length > 0 && !a.targetTenants.includes(tenantId)) return false;
    return true;
  });

  // ピン留めを最上部、続いて送信日時(createdAt)降順
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
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

export type CreateAnnouncementParams = {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  importance: AnnouncementImportance;
  pinned: boolean;
  targetTenants: string[];
  publishedAt?: string;
  publishUntil?: string;
  status?: AnnouncementStatus;
};

export async function createAnnouncement(params: CreateAnnouncementParams): Promise<Announcement> {
  const dbId = getDbId();
  if (!dbId) throw new Error('NOTION_ANNOUNCEMENTS_DB_ID 未設定');
  const status = params.status ?? '公開';
  const props: Record<string, unknown> = {
    タイトル: { title: [{ text: { content: params.title.slice(0, 200) } }] },
    本文: { rich_text: richText(params.body) },
    重要度: { select: { name: params.importance } },
    宛先種別: { select: { name: params.audience } },
    ピン留め: { checkbox: params.pinned },
    公開ステータス: { select: { name: status } },
  };
  if (params.targetTenants.length > 0) {
    props['対象テナント'] = {
      multi_select: params.targetTenants.map((name) => ({ name })),
    };
  }
  if (params.publishedAt) {
    props['公開日'] = { date: { start: params.publishedAt } };
  }
  if (params.publishUntil) {
    props['公開終了日'] = { date: { start: params.publishUntil } };
  }
  const page = (await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties: props,
  })) as { id: string; created_time?: string; properties: Record<string, unknown> };
  // キャッシュ invalidate（全テナントのお知らせキャッシュ＝`announcements:` 接頭辞すべて）
  invalidate('announcements:');
  return pageToAnnouncement(page);
}

/**
 * 店舗ダッシュボード向け: 宛先種別=店舗向け かつ（対象テナント空 or tenantId を含む）を返す。
 * Phase3 の店舗ダッシュボード実装時に利用する。
 */
export async function listAnnouncementsForStore(tenantId: string): Promise<Announcement[]> {
  const dbId = getDbId();
  if (!dbId) return [];

  const cacheKey = `announcements:store:${tenantId}`;
  const hit = getCached<Announcement[]>(cacheKey);
  if (hit) return hit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 50,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    filter: {
      and: [
        { property: '公開ステータス', select: { equals: '公開' } },
        { property: '宛先種別', select: { equals: '店舗向け' } },
      ],
    },
  })) as { results?: Array<{ id: string; created_time?: string; properties: Record<string, unknown> }> };

  const today = new Date().toISOString().slice(0, 10);
  const all = (res.results || []).map(pageToAnnouncement);
  const filtered = all.filter((a) => {
    if (a.publishedAt && a.publishedAt > today) return false;
    if (a.publishUntil && a.publishUntil < today) return false;
    if (a.targetTenants.length > 0 && !a.targetTenants.includes(tenantId)) return false;
    return true;
  });

  // ピン留めを最上部、続いて送信日時(createdAt)降順
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  setCached(cacheKey, filtered, 60_000);
  return filtered;
}

export async function listAllAnnouncementsAdmin(): Promise<Announcement[]> {
  const dbId = getDbId();
  if (!dbId) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await notionRequest('POST', `/databases/${dbId}/query`, {
    page_size: 100,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  })) as { results?: Array<{ id: string; created_time?: string; properties: Record<string, unknown> }> };
  return (res.results || []).map(pageToAnnouncement);
}

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const dbId = getDbId();
  if (!dbId) return null;
  try {
    const page = (await notionRequest('GET', `/pages/${id}`)) as {
      id: string;
      created_time?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: Record<string, any>;
    };
    return pageToAnnouncement(page);
  } catch (e) {
    console.error('[announcements] getAnnouncementById failed:', e);
    return null;
  }
}
