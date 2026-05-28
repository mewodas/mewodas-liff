'use client';

// デモモードのクライアント側ユーティリティ
// デモ判定の単一ソース: localStorage `fitmeal_demo_token`

export const DEMO_TOKEN_STORAGE_KEY = 'fitmeal_demo_token';

export function getDemoToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(DEMO_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isDemoMode(): boolean {
  return !!getDemoToken();
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
  } catch {
    // ignore
  }
}
