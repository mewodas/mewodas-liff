// テナント（ジム）設定の抽象化レイヤー
//
// 現状：単一テナント（メヲダス）のみ静的に定義。
// テナント自動プロビジョニング先は Notion「FitMeal テナント」DB（FITMEAL_TENANTS_DB_ID）。
// 将来：getCurrentTenant() を非同期化してリクエストコンテキストから解決。

/** FitMeal テナント管理用 Notion DB ID */
export const FITMEAL_TENANTS_DB_ID =
  process.env.FITMEAL_TENANTS_DB_ID || '4468b0213fd04328b93c13e71fd3dde7';

/** 新規テナント DB の親ページ（🥗 食事管理システム｜メヲダス五反田店） */
export const FITMEAL_TENANTS_PARENT_PAGE_ID =
  process.env.FITMEAL_TENANTS_PARENT_PAGE_ID || '34ea47a8738d8155a2b1e9f4607e8986';

export type TenantConfig = {
  /** テナント識別子（gym_id） */
  id: string;
  /** ジム名（表示用） */
  name: string;
  /** Notion API Token */
  notionApiKey: string;
  /** Notion 顧客DB ID */
  notionCustomerDbId: string;
  /** Notion 食事DB ID */
  notionFoodDbId: string;
  /** Google Drive 親フォルダID（食事画像保存先） */
  driveFolderId?: string;
  /** Gemini APIキー（テナント共有可、テナント別も可） */
  geminiApiKey?: string;
  /** GAS Web App エンドポイント */
  gasEndpoint?: string;
  /** LIFF ID（フロントエンド用） */
  liffId?: string;
  /** LINE Messaging API Channel Access Token（push 用） */
  lineChannelToken?: string;
  /** LINE自動送付ON/OFF */
  lineAutoSendEnabled?: boolean;
  /** 自動送付時刻 "HH:MM" JST */
  autoSendTime?: string;
  /** ブランドカラー（HEX） */
  themeColor?: string;
  /** ジムのデフォルトPFC目標 */
  defaultGoals: { kcal: number; P: number; F: number; C: number };
};

// メヲダス（現状の単一テナント）
const MEWODAS_TENANT: TenantConfig = {
  id: 'mewodas',
  name: 'メヲダス 五反田店',
  notionApiKey: process.env.NOTION_API_KEY || '',
  notionCustomerDbId:
    process.env.NOTION_CUSTOMER_DB_ID || '2d6ec0c0531b4ef6a4c396baa6807546',
  notionFoodDbId:
    process.env.NOTION_FOOD_DB_ID || '8719d5ab23074ea5bf6e77fde352db86',
  driveFolderId: process.env.DRIVE_PARENT_FOLDER_ID,
  geminiApiKey: process.env.GEMINI_API_KEY,
  gasEndpoint: process.env.GAS_RECORD_ENDPOINT,
  liffId: process.env.NEXT_PUBLIC_LIFF_ID,
  themeColor: '#059669',
  defaultGoals: { kcal: 2000, P: 100, F: 56, C: 275 },
};

// テナント登録テーブル
// 将来：新規ジム追加時にここに追記、またはDBから動的取得
const TENANTS: Record<string, TenantConfig> = {
  mewodas: MEWODAS_TENANT,
};

/**
 * テナントIDからテナント設定を取得。
 * 未指定 or 不明な場合はデフォルト（メヲダス）を返す。
 */
export function getTenantById(id?: string | null): TenantConfig {
  if (!id) return MEWODAS_TENANT;
  return TENANTS[id] || MEWODAS_TENANT;
}

/**
 * 現在のテナントを返す。
 * - AsyncLocalStorage に context があればそれを返す（withAdminTenant/withLiffTenant で設定）
 * - 未設定ならフォールバックで MEWODAS（既存挙動互換）
 */
export function getCurrentTenant(): TenantConfig {
  // 循環import回避のため inline require
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCurrentTenantFromContext } = require('./tenantContext') as typeof import('./tenantContext');
  return getCurrentTenantFromContext() ?? MEWODAS_TENANT;
}

/** ラッパーから使う：context 未解決時のフォールバック */
export function getDefaultTenant(): TenantConfig {
  return MEWODAS_TENANT;
}

/**
 * 全テナント一覧を取得（管理機能用）。
 */
export function getAllTenants(): TenantConfig[] {
  return Object.values(TENANTS);
}
