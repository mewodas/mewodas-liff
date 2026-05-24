import { getIdToken, refreshLiff } from './liff';

export const TENANT_ID_STORAGE_KEY = 'fitmeal_tenant_id';

function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TENANT_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function buildHeaders(base: HeadersInit | undefined, idToken: string): Headers {
  const headers = new Headers(base);
  headers.set('Authorization', `Bearer ${idToken}`);
  // 共通 LIFF 配下の SaaS テナント向け: 一度解決した tenantId を全 API 呼び出しで自動付与
  // 既に呼び出し側で x-tenant-id をセットしている場合はそれを優先（明示的な指定を尊重）
  if (!headers.has('x-tenant-id')) {
    const stored = getStoredTenantId();
    if (stored) headers.set('x-tenant-id', stored);
  }
  return headers;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('LINE IDトークンの取得に失敗しました。再ログインしてください。');
  }
  const headers = buildHeaders(init?.headers, idToken);
  const res = await fetch(input, { ...init, headers });

  // IDトークン期限切れの可能性: 401 を1回だけリトライ（LIFF を再初期化して新トークンで再送信）
  if (res.status === 401) {
    await refreshLiff();
    const refreshed = await getIdToken();
    if (refreshed && refreshed !== idToken) {
      const retryHeaders = buildHeaders(init?.headers, refreshed);
      return fetch(input, { ...init, headers: retryHeaders });
    }
  }
  return res;
}
