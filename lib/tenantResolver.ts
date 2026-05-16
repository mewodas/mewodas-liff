// テナント解決ロジック
//
// Notion「FitMeal テナント」DB から TenantConfig を読み込み、メモリキャッシュ（5分TTL）。
// マスタの env を引き継ぐ部分（APIキー等）と Notion からの動的部分（顧客DB ID, LIFF ID等）を合成。

import { listTenantRows } from './notion';
import type { TenantConfig } from './tenant';
import { FITMEAL_TENANTS_DB_ID } from './tenant';

export { FITMEAL_TENANTS_DB_ID };

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { tenants: Map<string, TenantConfig>; liffMap: Map<string, TenantConfig>; expiry: number } | null = null;

function baseConfig(): Omit<TenantConfig, 'id' | 'name' | 'notionCustomerDbId' | 'notionFoodDbId' | 'liffId'> {
  return {
    notionApiKey: process.env.NOTION_API_KEY || '',
    driveFolderId: process.env.DRIVE_PARENT_FOLDER_ID,
    geminiApiKey: process.env.GEMINI_API_KEY,
    gasEndpoint: process.env.GAS_RECORD_ENDPOINT,
    themeColor: '#059669',
    defaultGoals: { kcal: 2000, P: 100, F: 56, C: 275 },
  };
}

async function loadTenants(): Promise<{ tenants: Map<string, TenantConfig>; liffMap: Map<string, TenantConfig> }> {
  if (cache && Date.now() < cache.expiry) {
    return { tenants: cache.tenants, liffMap: cache.liffMap };
  }
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const tenants = new Map<string, TenantConfig>();
  const liffMap = new Map<string, TenantConfig>();
  const base = baseConfig();
  for (const r of rows) {
    if (!r.tenantId || !r.customerDbId || !r.foodDbId) continue;
    if (r.status === '解約') continue;
    const cfg: TenantConfig = {
      id: r.tenantId,
      name: r.name,
      notionCustomerDbId: r.customerDbId,
      notionFoodDbId: r.foodDbId,
      liffId: r.liffId ?? undefined,
      lineChannelToken: r.lineChannelToken ?? undefined,
      lineAutoSendEnabled: r.lineAutoSendEnabled,
      autoSendTime: r.autoSendTime ?? undefined,
      ...base,
    };
    tenants.set(r.tenantId, cfg);
    if (r.liffId) liffMap.set(r.liffId, cfg);
  }
  cache = { tenants, liffMap, expiry: Date.now() + CACHE_TTL_MS };
  return { tenants, liffMap };
}

export async function getTenantByIdAsync(id: string): Promise<TenantConfig | null> {
  const { tenants } = await loadTenants();
  return tenants.get(id) ?? null;
}

export async function resolveTenantByLiffId(liffId: string): Promise<TenantConfig | null> {
  const { liffMap } = await loadTenants();
  return liffMap.get(liffId) ?? null;
}

/** パスワード再設定用: ownerEmail でテナント検索（ハッシュ未設定でも可、解約は除外） */
export async function findTenantByOwnerEmail(email: string): Promise<{
  tenantId: string;
  tenantName: string;
  pageId: string;
} | null> {
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const normalized = email.toLowerCase();
  const row = rows.find(
    (r) => r.ownerEmail?.toLowerCase() === normalized && r.status !== '解約'
  );
  if (!row) return null;
  return { tenantId: row.tenantId, tenantName: row.name, pageId: row.pageId };
}

/** Tenant admin ログイン用: email でテナントを検索（ハッシュも合わせて返す） */
export async function findTenantAdminByEmail(email: string): Promise<{
  tenantId: string;
  tenantName: string;
  pageId: string;
  passwordHash: string;
} | null> {
  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const normalized = email.toLowerCase();
  const row = rows.find(
    (r) =>
      r.ownerEmail?.toLowerCase() === normalized &&
      !!r.passwordHash &&
      r.status !== '解約'
  );
  if (!row) return null;
  return {
    tenantId: row.tenantId,
    tenantName: row.name,
    pageId: row.pageId,
    passwordHash: row.passwordHash!,
  };
}

export async function listAllTenants(): Promise<TenantConfig[]> {
  const { tenants } = await loadTenants();
  return Array.from(tenants.values());
}

/** 公開 API 用: ジム名または tenantId でテナントを検索 */
export async function findTenantBySlugOrId(slugOrId: string): Promise<TenantConfig | null> {
  if (!slugOrId) return null;
  const { tenants } = await loadTenants();
  const byId = tenants.get(slugOrId);
  if (byId) return byId;
  const lower = slugOrId.toLowerCase();
  for (const t of tenants.values()) {
    if (t.name.toLowerCase().includes(lower) || t.id.toLowerCase() === lower) return t;
  }
  return null;
}

export function invalidateTenantCache(): void {
  cache = null;
}
