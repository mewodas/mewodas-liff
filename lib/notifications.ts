// 通知/レポートのストレージ層（Notion）
//
// 必要な環境変数: NOTION_NOTIFICATIONS_DB_ID
// Notion DB スキーマ:
//   - タイトル (title)
//   - LINEユーザーID (rich_text)
//   - 顧客名 (rich_text)
//   - カテゴリ (select) "前日レポート" / "週次レポート" / "お知らせ" / "アドバイス"
//   - 本文 (rich_text)
//   - 既読 (checkbox)
//   - 既読日時 (date)
//
// オプション環境変数: LINE_CHANNEL_ACCESS_TOKEN（あれば LINE push 同時実行）

import { getTenantNotion } from '@/lib/notion';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2025-09-03';

export type NotificationCategory = '前日レポート' | '週次レポート' | 'お知らせ' | 'アドバイス';

export type Notification = {
  id: string;
  lineUserId: string;
  customerName: string;
  category: NotificationCategory | string;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

function getDbId(): string | null {
  return process.env.NOTION_NOTIFICATIONS_DB_ID || null;
}

export function isNotificationsConfigured(): boolean {
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

function pageToNotification(page: { id: string; properties: Record<string, any>; created_time: string }): Notification {
  const p = page.properties;
  return {
    id: page.id,
    lineUserId: p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '',
    customerName: p['顧客名']?.rich_text?.[0]?.plain_text || '',
    category: p['カテゴリ']?.select?.name || 'お知らせ',
    title: p['タイトル']?.title?.[0]?.plain_text || '',
    body: p['本文']?.rich_text?.map((rt: { plain_text: string }) => rt.plain_text).join('') || '',
    read: !!p['既読']?.checkbox,
    readAt: p['既読日時']?.date?.start || null,
    createdAt: page.created_time,
  };
}

export async function createNotification(params: {
  lineUserId: string;
  customerName: string;
  category: NotificationCategory;
  title: string;
  body: string;
}): Promise<Notification> {
  const dbId = getDbId();
  if (!dbId) throw new Error('NOTION_NOTIFICATIONS_DB_ID 未設定');
  const richText = (s: string) => {
    // Notion は rich_text 1要素 2000文字制限。チャンク分割
    const chunks: string[] = [];
    let rest = s;
    while (rest.length > 0) {
      chunks.push(rest.slice(0, 1800));
      rest = rest.slice(1800);
    }
    return chunks.map((c) => ({ text: { content: c } }));
  };
  const res = await notionRequest('POST', '/pages', {
    parent: { database_id: dbId },
    properties: {
      タイトル: { title: [{ text: { content: params.title.slice(0, 200) } }] },
      LINEユーザーID: { rich_text: [{ text: { content: params.lineUserId } }] },
      顧客名: { rich_text: [{ text: { content: params.customerName.slice(0, 200) } }] },
      カテゴリ: { select: { name: params.category } },
      本文: { rich_text: richText(params.body) },
      既読: { checkbox: false },
    },
  });
  return pageToNotification(res);
}

export async function listNotificationsByLineUser(lineUserId: string, limit: number = 50): Promise<Notification[]> {
  const dbId = getDbId();
  if (!dbId) return [];
  const res = await notionRequest('POST', `/databases/${dbId}/query`, {
    filter: { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: Math.min(100, Math.max(1, limit)),
  });
  return (res.results || []).map(pageToNotification);
}

export async function listAllNotifications(limit: number = 100): Promise<Notification[]> {
  const dbId = getDbId();
  if (!dbId) return [];
  const res = await notionRequest('POST', `/databases/${dbId}/query`, {
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: Math.min(100, Math.max(1, limit)),
  });
  return (res.results || []).map(pageToNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  const dbId = getDbId();
  if (!dbId) throw new Error('NOTION_NOTIFICATIONS_DB_ID 未設定');
  await notionRequest('PATCH', `/pages/${id}`, {
    properties: {
      既読: { checkbox: true },
      既読日時: { date: { start: new Date().toISOString() } },
    },
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${id}`, { archived: true });
}

// LINE Messaging API: 顧客にpushメッセージを送る
// LINE_CHANNEL_ACCESS_TOKEN が未設定の場合は何もしない（保存のみ）
export async function pushLineMessage(
  lineUserId: string,
  title: string,
  body: string
): Promise<{ pushed: boolean; reason?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { pushed: false, reason: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' };
  const liffUrl = process.env.NEXT_PUBLIC_LIFF_URL || '';
  const messages: object[] = [
    {
      type: 'text',
      text: `🔔 ${title}\n\n${body.slice(0, 1900)}`,
    },
  ];
  // 顧客LIFFへ誘導するボタン（LIFF URL が設定されている場合のみ）
  if (liffUrl) {
    messages.push({
      type: 'template',
      altText: title,
      template: {
        type: 'buttons',
        title: title.slice(0, 40),
        text: body.slice(0, 60) || 'トレーナーからお知らせがあります',
        actions: [
          {
            type: 'uri',
            label: 'アプリで見る',
            uri: `${liffUrl}/notifications`,
          },
        ],
      },
    });
  }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { pushed: false, reason: `LINE push ${res.status}: ${text.slice(0, 200)}` };
  }
  return { pushed: true };
}
