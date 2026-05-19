import { getIdToken } from './liff';

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
  return fetch(input, { ...init, headers });
}
