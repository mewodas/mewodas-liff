// テナントコンテキスト（AsyncLocalStorage）
//
// リクエストごとに「いまどのテナントの処理中か」を保持。
// `withTenantContext()` でラップした async 実行内では `getCurrentTenantFromContext()` でテナント設定が読める。
// ラップ外（context 未設定時）は null を返すので、`lib/tenant.ts:getCurrentTenant()` が
// 既存挙動（MEWODAS_TENANT フォールバック）を維持する。

import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantConfig } from './tenant';

const storage = new AsyncLocalStorage<TenantConfig>();

export function runInTenantContext<T>(tenant: TenantConfig, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(tenant, fn);
}

export function getCurrentTenantFromContext(): TenantConfig | null {
  return storage.getStore() ?? null;
}
