import { getIdToken, refreshLiff } from './liff';

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('LINE IDトークンの取得に失敗しました。再ログインしてください。');
  }
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  const res = await fetch(input, { ...init, headers });

  // IDトークン期限切れの可能性: 401 を1回だけリトライ（LIFF を再初期化して新トークンで再送信）
  if (res.status === 401) {
    await refreshLiff();
    const refreshed = await getIdToken();
    if (refreshed && refreshed !== idToken) {
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('Authorization', `Bearer ${refreshed}`);
      return fetch(input, { ...init, headers: retryHeaders });
    }
  }
  return res;
}
