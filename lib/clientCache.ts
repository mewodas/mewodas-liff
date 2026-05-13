// クライアントサイドの簡易キャッシュ（モジュールレベル、ページ遷移で保持）
// stale-while-revalidate パターン用

type CacheEntry<T> = { data: T; ts: number };

const cache = new Map<string, CacheEntry<unknown>>();
const STALE_AFTER_MS = 60 * 1000; // 60秒後にstale扱い（バックグラウンド再取得）
const MAX_AGE_MS = 5 * 60 * 1000; // 5分超えたら強制再取得（古すぎる）

export function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const age = Date.now() - entry.ts;
  if (age > MAX_AGE_MS) {
    cache.delete(key);
    return null;
  }
  return { data: entry.data, isStale: age > STALE_AFTER_MS };
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidate(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
