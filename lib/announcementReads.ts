const STORE_KEY = 'fitmeal_store_read_announcements';
const CUSTOMER_KEY = 'fitmeal_read_announcements';

function storageKey(scope: 'customer' | 'store'): string {
  return scope === 'customer' ? CUSTOMER_KEY : STORE_KEY;
}

export function getReadAnnouncementIds(scope: 'customer' | 'store' = 'store'): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey(scope));
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markAnnouncementRead(id: string, scope: 'customer' | 'store' = 'store'): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getReadAnnouncementIds(scope);
    set.add(id);
    localStorage.setItem(storageKey(scope), JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function isAnnouncementRead(id: string, scope: 'customer' | 'store' = 'store'): boolean {
  return getReadAnnouncementIds(scope).has(id);
}
