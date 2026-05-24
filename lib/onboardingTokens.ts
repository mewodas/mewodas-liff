// オーナー LINE userId 取得用の一時トークン管理
// Vercel は複数インスタンスになりうるが 15 分 TTL のベストエフォートで十分
//
// Map: token -> { tenantId, expiresAt }

type Entry = { tenantId: string; expiresAt: number };
const TOKEN_TTL_MS = 15 * 60 * 1000;

// Node.js グローバルスコープでインスタンスをシングルトン化する
const g = globalThis as typeof globalThis & { __onboardingTokens?: Map<string, Entry> };
if (!g.__onboardingTokens) g.__onboardingTokens = new Map();
const tokens = g.__onboardingTokens;

export function issueToken(tenantId: string): string {
  const token = crypto.randomUUID();
  tokens.set(token, { tenantId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function consumeToken(token: string): string | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token);
  return entry.tenantId;
}
