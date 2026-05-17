// LINE Messaging API helpers
//
// 公式LINE 友だち追加URL を Channel Access Token から自動取得する。
// LINE API: GET /v2/bot/info
//   レスポンス: { userId, basicId(@xxxx), premiumId(@vanity or null), displayName, ... }

const cache = new Map<string, { url: string; expiry: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

/**
 * Channel Access Token を使って公式LINE 友だち追加URL を取得。
 * - premiumId（カスタムID）が設定されていればそれを優先
 * - 無ければ basicId（@xxxxxxxx の自動付与ID）
 * - 失敗時は null
 */
export async function fetchOfficialLineUrl(channelToken: string): Promise<string | null> {
  if (!channelToken) return null;

  const cached = cache.get(channelToken);
  if (cached && Date.now() < cached.expiry) return cached.url;

  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${channelToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      basicId?: string;
      premiumId?: string | null;
    };
    const id = data.premiumId || data.basicId;
    if (!id) return null;
    // basicId / premiumId には既に @ が含まれている（例: "@123abcde"）
    const url = `https://line.me/R/ti/p/${encodeURIComponent(id)}`;
    cache.set(channelToken, { url, expiry: Date.now() + CACHE_TTL_MS });
    return url;
  } catch {
    return null;
  }
}
