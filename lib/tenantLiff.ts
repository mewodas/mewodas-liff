// クライアントサイド: URL の ?tenantId= から tenant-config を取得し
// 適切な liffId で LIFF を初期化するヘルパー。
// ブラウザ専用 (use client ページから呼ぶこと)

const SESSION_KEY = 'fitmeal_tenant_id';

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeTenantId(id: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    // ignore
  }
}

export type TenantPublicConfig = {
  liffId: string | null;
  gymName: string;
  brandColor: string;
  logoUrl: string | null;
  officialLineUrl: string | null;
};

async function fetchTenantConfig(tenantId: string): Promise<TenantPublicConfig | null> {
  try {
    const res = await fetch(`/api/public/tenant-config?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return null;
    return res.json() as Promise<TenantPublicConfig>;
  } catch {
    return null;
  }
}

/**
 * URL の ?tenantId= を読み、tenant-config から liffId を解決して initLiff を呼ぶ。
 * tenantId が無い or 取得失敗時は NEXT_PUBLIC_LIFF_ID にフォールバック。
 * 解決した tenantId は sessionStorage に保存する。
 *
 * @returns 解決できた tenantId（フォールバック時は null）
 */
export async function initLiffWithTenant(
  initLiff: (overrideLiffId?: string) => Promise<unknown>
): Promise<{ tenantId: string | null; config: TenantPublicConfig | null }> {
  let tenantId: string | null = null;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    tenantId = params.get('tenantId');
    if (!tenantId) tenantId = getStoredTenantId();
  }

  if (!tenantId) {
    await initLiff();
    return { tenantId: null, config: null };
  }

  const config = await fetchTenantConfig(tenantId);
  if (!config || !config.liffId) {
    await initLiff();
    return { tenantId: null, config: null };
  }

  storeTenantId(tenantId);
  await initLiff(config.liffId);
  return { tenantId, config };
}
