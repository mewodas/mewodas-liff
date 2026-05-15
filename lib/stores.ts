// 店舗マスター（Notion）
// FitMeal 店舗 DB: 全テナント横断、tenant_id で分離。
// 1テナント = 1〜N 店舗。1顧客 = 1店舗に所属。
// レポート末尾の署名にも使用。

import { getCurrentTenant } from './tenant';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

/** FitMeal 店舗 DB（全テナント横断） */
export const FITMEAL_STORES_DB_ID =
  process.env.FITMEAL_STORES_DB_ID || 'b74788a742a44ed78081d6536c427ce3';

export type Store = {
  pageId: string;
  storeId: string;
  name: string;
  tenantId: string;
  address: string;
  phone: string;
  hours: string;
  manager: string;
  signature: string;
  active: boolean;
};

async function notionRequest(method: string, path: string, body?: object): Promise<any> {
  const apiKey = getCurrentTenant().notionApiKey || process.env.NOTION_API_KEY || '';
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

function pageToStore(page: { id: string; properties: Record<string, any> }): Store {
  const p = page.properties;
  return {
    pageId: page.id,
    storeId: p['店舗ID']?.rich_text?.[0]?.plain_text || '',
    name: p['店舗名']?.title?.[0]?.plain_text || '',
    tenantId: p['tenant_id']?.rich_text?.[0]?.plain_text || '',
    address: p['住所']?.rich_text?.[0]?.plain_text || '',
    phone: p['電話番号']?.phone_number || '',
    hours: p['営業時間']?.rich_text?.[0]?.plain_text || '',
    manager: p['担当者']?.rich_text?.[0]?.plain_text || '',
    signature: p['署名']?.rich_text?.[0]?.plain_text || '',
    active: p['有効']?.checkbox !== false,
  };
}

/** 現在テナントの全店舗を取得（有効のみ） */
export async function listStoresForCurrentTenant(): Promise<Store[]> {
  const tenant = getCurrentTenant();
  const res = await notionRequest('POST', `/databases/${FITMEAL_STORES_DB_ID}/query`, {
    page_size: 100,
    filter: {
      and: [
        { property: 'tenant_id', rich_text: { equals: tenant.id } },
        { property: '有効', checkbox: { equals: true } },
      ],
    },
  });
  return (res.results || []).map(pageToStore);
}

/** 指定テナントの店舗を取得（マスタがテナント詳細から呼ぶ） */
export async function listStoresByTenantId(tenantId: string): Promise<Store[]> {
  const res = await notionRequest('POST', `/databases/${FITMEAL_STORES_DB_ID}/query`, {
    page_size: 100,
    filter: {
      and: [
        { property: 'tenant_id', rich_text: { equals: tenantId } },
        { property: '有効', checkbox: { equals: true } },
      ],
    },
  });
  return (res.results || []).map(pageToStore);
}

/** 全店舗を取得（マスタ画面用、テナント横断） */
export async function listAllStores(): Promise<Store[]> {
  const res = await notionRequest('POST', `/databases/${FITMEAL_STORES_DB_ID}/query`, {
    page_size: 100,
  });
  return (res.results || []).map(pageToStore);
}

export async function getStore(pageId: string): Promise<Store | null> {
  try {
    const res = await notionRequest('GET', `/pages/${pageId}`);
    return pageToStore(res);
  } catch {
    return null;
  }
}

/** 店舗ID（rich text）から店舗を解決 */
export async function getStoreByStoreId(storeId: string): Promise<Store | null> {
  if (!storeId) return null;
  const tenant = getCurrentTenant();
  const res = await notionRequest('POST', `/databases/${FITMEAL_STORES_DB_ID}/query`, {
    page_size: 1,
    filter: {
      and: [
        { property: 'tenant_id', rich_text: { equals: tenant.id } },
        { property: '店舗ID', rich_text: { equals: storeId } },
      ],
    },
  });
  if (!res.results || res.results.length === 0) return null;
  return pageToStore(res.results[0]);
}

export async function createStore(params: {
  name: string;
  storeId: string;
  tenantId?: string; // 省略時は現在テナント
  address?: string;
  phone?: string;
  hours?: string;
  manager?: string;
  signature?: string;
}): Promise<Store> {
  const tenantId = params.tenantId || getCurrentTenant().id;
  const res = await notionRequest('POST', '/pages', {
    parent: { database_id: FITMEAL_STORES_DB_ID },
    properties: {
      店舗名: { title: [{ text: { content: params.name.slice(0, 100) } }] },
      tenant_id: { rich_text: [{ text: { content: tenantId } }] },
      店舗ID: { rich_text: [{ text: { content: params.storeId.slice(0, 50) } }] },
      住所: params.address ? { rich_text: [{ text: { content: params.address.slice(0, 200) } }] } : { rich_text: [] },
      電話番号: params.phone ? { phone_number: params.phone } : { phone_number: null },
      営業時間: params.hours ? { rich_text: [{ text: { content: params.hours.slice(0, 200) } }] } : { rich_text: [] },
      担当者: params.manager ? { rich_text: [{ text: { content: params.manager.slice(0, 100) } }] } : { rich_text: [] },
      署名: params.signature ? { rich_text: [{ text: { content: params.signature.slice(0, 200) } }] } : { rich_text: [] },
      有効: { checkbox: true },
    },
  });
  return pageToStore(res);
}

export async function updateStore(
  pageId: string,
  patch: {
    name?: string;
    storeId?: string;
    address?: string;
    phone?: string;
    hours?: string;
    manager?: string;
    signature?: string;
    active?: boolean;
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (patch.name !== undefined) properties['店舗名'] = { title: [{ text: { content: patch.name.slice(0, 100) } }] };
  if (patch.storeId !== undefined) properties['店舗ID'] = { rich_text: [{ text: { content: patch.storeId.slice(0, 50) } }] };
  if (patch.address !== undefined) properties['住所'] = { rich_text: [{ text: { content: patch.address.slice(0, 200) } }] };
  if (patch.phone !== undefined) properties['電話番号'] = patch.phone ? { phone_number: patch.phone } : { phone_number: null };
  if (patch.hours !== undefined) properties['営業時間'] = { rich_text: [{ text: { content: patch.hours.slice(0, 200) } }] };
  if (patch.manager !== undefined) properties['担当者'] = { rich_text: [{ text: { content: patch.manager.slice(0, 100) } }] };
  if (patch.signature !== undefined) properties['署名'] = { rich_text: [{ text: { content: patch.signature.slice(0, 200) } }] };
  if (patch.active !== undefined) properties['有効'] = { checkbox: patch.active };
  if (Object.keys(properties).length === 0) return;
  await notionRequest('PATCH', `/pages/${pageId}`, { properties });
}

export async function deleteStore(pageId: string): Promise<void> {
  await notionRequest('PATCH', `/pages/${pageId}`, { archived: true });
}
