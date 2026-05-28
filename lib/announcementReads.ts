const STORAGE_KEY = 'fitmeal_read_announcements';

export function getReadAnnouncementIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markAnnouncementRead(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getReadAnnouncementIds();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function isAnnouncementRead(id: string): boolean {
  return getReadAnnouncementIds().has(id);
}
