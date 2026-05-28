'use client';

// デモモードのクライアント側ユーティリティ
// トークン取得優先順位: URLクエリ preview_token → sessionStorage → localStorage

export const DEMO_TOKEN_STORAGE_KEY = 'fitmeal_demo_token';
const PREVIEW_SESSION_KEY = 'fitmeal_preview_token';

function getPreviewTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('preview_token');
  } catch {
    return null;
  }
}

function getPreviewTokenFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(PREVIEW_SESSION_KEY);
  } catch {
    return null;
  }
}

function persistPreviewToken(token: string): void {
  try {
    sessionStorage.setItem(PREVIEW_SESSION_KEY, token);
  } catch {
    // ignore
  }
}

export function getDemoToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. URL クエリ preview_token が存在すれば sessionStorage に保持して返す（localStorage には書かない）
  const urlToken = getPreviewTokenFromUrl();
  if (urlToken) {
    persistPreviewToken(urlToken);
    return urlToken;
  }

  // 2. sessionStorage（iframe 内ページ遷移用）
  const sessionToken = getPreviewTokenFromSession();
  if (sessionToken) return sessionToken;

  // 3. localStorage（公開 /demo の kind:'demo' トークン）
  try {
    return localStorage.getItem(DEMO_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isDemoMode(): boolean {
  return !!getDemoToken();
}

// プレビュー（ストアの顧客画面プレビュー iframe）かどうか。
// URL preview_token または sessionStorage 由来 = プレビュー。localStorage 由来 = 公開 /demo。
export function isPreviewMode(): boolean {
  return !!(getPreviewTokenFromUrl() || getPreviewTokenFromSession());
}

export function setDemoToken(token: string, tenantId: string): void {
  try {
    localStorage.setItem(DEMO_TOKEN_STORAGE_KEY, token);
    localStorage.setItem('fitmeal_tenant_id', tenantId);
  } catch {
    // ignore
  }
}

export function clearDemoMode(): void {
  try {
    localStorage.removeItem(DEMO_TOKEN_STORAGE_KEY);
    localStorage.removeItem('fitmeal_tenant_id');
    sessionStorage.removeItem(PREVIEW_SESSION_KEY);
  } catch {
    // ignore
  }
}
