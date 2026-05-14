// クライアントサイドの簡易キャッシュ（メモリ + localStorage 永続化）
// stale-while-revalidate パターン用

type CacheEntry<T> = { data: T; ts: number };

const cache = new Map<string, CacheEntry<unknown>>();
const STALE_AFTER_MS = 60 * 1000; // 60秒後にstale扱い（バックグラウンド再取得）
const MAX_AGE_MS = 5 * 60 * 1000; // 5分超えたら強制再取得（古すぎる）

// localStorage キー prefix。スキーマ変更時はバージョンを上げる
const STORAGE_VERSION = 'v1';
const STORAGE_PREFIX = `mlcache_${STORAGE_VERSION}_`;

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!window.localStorage) return false;
    const t = '__mlcache_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

const storageOk = isStorageAvailable();

// 起動時に localStorage から読み込んでメモリへハイドレート、古いものは削除
function hydrate(): void {
  if (!storageOk) return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const fullKey = window.localStorage.key(i);
      if (!fullKey) continue;
      // 旧バージョン or 別 prefix のキーは削除候補
      if (fullKey.startsWith('mlcache_') && !fullKey.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(fullKey);
        continue;
      }
      if (!fullKey.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(fullKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as CacheEntry<unknown>;
        if (!parsed || typeof parsed.ts !== 'number') {
          keysToRemove.push(fullKey);
          continue;
        }
        if (now - parsed.ts > MAX_AGE_MS) {
          keysToRemove.push(fullKey);
          continue;
        }
        const key = fullKey.slice(STORAGE_PREFIX.length);
        cache.set(key, parsed);
      } catch {
        keysToRemove.push(fullKey);
      }
    }
    for (const k of keysToRemove) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

hydrate();

export function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const age = Date.now() - entry.ts;
  if (age > MAX_AGE_MS) {
    cache.delete(key);
    removeFromStorage(key);
    return null;
  }
  return { data: entry.data, isStale: age > STALE_AFTER_MS };
}

export function setCached<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  cache.set(key, entry);
  writeToStorage(key, entry);
}

export function invalidate(prefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      removeFromStorage(key);
    }
  }
}

function writeToStorage<T>(key: string, entry: CacheEntry<T>): void {
  if (!storageOk) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // QuotaExceededError 等は無視（メモリキャッシュは効いている）
  }
}

function removeFromStorage(key: string): void {
  if (!storageOk) return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}
