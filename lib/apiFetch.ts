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
  //
  // 既知の trade-off: 既存メヲダス顧客が他テナントの招待 URL を踏むと localStorage が上書きされ、
  //   以降の全 API 呼び出しが新テナントに向く。実運用では現実的に低リスク（招待 URL は
  //   ジムが自社顧客にのみ配布する想定）だが、別端末ログインや誤クリックでの混乱は起こりうる。
  //   今後: 既登録ユーザーは現テナントを優先する仕様に変更検討。
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
