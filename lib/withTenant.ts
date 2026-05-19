// API ルートをテナントコンテキストでラップするヘルパー
//
// 使い方:
//   export const GET = withAdminTenant(async (req, ctx) => { ... });
//   export const POST = withLiffTenant(async (req, ctx, verifiedLineUserId) => { ... });

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createHash } from 'crypto';
import { runInTenantContext } from './tenantContext';
import { getTenantByIdAsync, resolveTenantByLiffId } from './tenantResolver';
import { verifySession, SESSION_COOKIE_NAME, type SessionPayload } from './adminAuth';
import { getDefaultTenant } from './tenant';

// Next.js のルートハンドラ第2引数は経路により形が違うため any 受けで通す
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: NextRequest, ctx: any) => Promise<Response> | Response;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LiffRouteHandler = (req: NextRequest, ctx: any, verifiedLineUserId: string) => Promise<Response> | Response;

// --- LINE IDトークン検証キャッシュ ---
type CacheEntry = { sub: string; expiresAt: number };
const tokenCache = new Map<string, CacheEntry>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5分
const TOKEN_CACHE_MAX = 100;

function tokenCacheKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function evictTokens(): void {
  const now = Date.now();
  for (const [k, v] of tokenCache) {
    if (now > v.expiresAt) tokenCache.delete(k);
  }
  while (tokenCache.size >= TOKEN_CACHE_MAX) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey === undefined) break;
    tokenCache.delete(firstKey);
  }
}

async function verifyLineIdToken(token: string): Promise<{ sub: string }> {
  const cacheKey = tokenCacheKey(token);
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return { sub: cached.sub };
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const channelId = liffId?.split('-')[0];
  if (!channelId) throw new Error('NEXT_PUBLIC_LIFF_ID not configured (channel ID derived from prefix)');

  let res: globalThis.Response;
  try {
    res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: token, client_id: channelId }).toString(),
    });
  } catch {
    throw new LineVerifyUnavailableError();
  }

  if (res.status >= 500) throw new LineVerifyUnavailableError();
  if (!res.ok) throw new LineVerifyInvalidTokenError();

  const json = await res.json();
  if (json.aud !== channelId) throw new LineVerifyInvalidTokenError('aud mismatch');
  const sub: string = json.sub;
  if (!sub) throw new LineVerifyInvalidTokenError();

  if (tokenCache.size >= TOKEN_CACHE_MAX) evictTokens();
  tokenCache.set(cacheKey, { sub, expiresAt: now + TOKEN_CACHE_TTL_MS });
  return { sub };
}

class LineVerifyUnavailableError extends Error {}
class LineVerifyInvalidTokenError extends Error {}

/** 管理画面ルート用ラッパー。Cookieセッションからテナント解決→context.run */
export function withAdminTenant(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySession(cookieValue);
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // staging 等の環境分離のため、非本番で env override があれば最優先
    const tenantIdOverride =
      process.env.VERCEL_ENV !== 'production' ? process.env.FITMEAL_TENANT_ID_OVERRIDE : undefined;
    const tenantId = tenantIdOverride || session.currentTenantId || 'mewodas';
    // Notion テナント DB アクセス失敗時はデフォルト（MEWODAS）にフォールバック
    let tenant;
    try {
      tenant = (await getTenantByIdAsync(tenantId)) || getDefaultTenant();
    } catch {
      tenant = getDefaultTenant();
    }
    // ハンドラ実行を try/catch でラップ：例外時も必ず JSON レスポンスを返す
    // フロント側 res.json() の「Unexpected end of JSON input」を防止
    try {
      return await runInTenantContext(tenant, () => handler(req, ctx));
    } catch (e) {
      console.error('[withAdminTenant] handler error:', e);
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setTag('tenant_id', tenant.id);
          scope.setTag('tenant_name', tenant.name);
          scope.setTag('error_source', 'withAdminTenant');
          Sentry.captureException(e);
        });
      }
      const message = e instanceof Error ? e.message : 'unknown error';
      return NextResponse.json(
        { error: message.slice(0, 500), errorType: 'handler_exception' },
        { status: 500 }
      );
    }
  };
}

/** LIFF（顧客）ルート用ラッパー。X-Liff-Id ヘッダーからテナント解決→context.run
 *  第3引数 verifiedLineUserId に LINE Verify API で検証済みの userId が渡される。
 *  後方互換のため第3引数は optional（既存の 2引数ハンドラもそのまま動く）。
 */
export function withLiffTenant(handler: LiffRouteHandler | RouteHandler): RouteHandler {
  return async (req, ctx) => {
    // --- LINE IDトークン検証 ---
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    let verifiedLineUserId: string;
    try {
      const result = await verifyLineIdToken(idToken);
      verifiedLineUserId = result.sub;
    } catch (e) {
      if (e instanceof LineVerifyUnavailableError) {
        return NextResponse.json({ error: 'LINE verification service unavailable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Invalid or expired LINE ID token' }, { status: 401 });
    }

    // --- テナント解決 ---
    const overrideId =
      process.env.VERCEL_ENV !== 'production' ? process.env.FITMEAL_TENANT_ID_OVERRIDE : undefined;
    if (overrideId) {
      try {
        const tenant = (await getTenantByIdAsync(overrideId)) || getDefaultTenant();
        return runInTenantContext(tenant, () => (handler as LiffRouteHandler)(req, ctx, verifiedLineUserId));
      } catch {
        // override 解決失敗時は通常フローへフォールバック
      }
    }
    const liffId = req.headers.get('x-liff-id') || '';
    let tenant = null;
    if (liffId) {
      try {
        tenant = await resolveTenantByLiffId(liffId);
      } catch {
        tenant = null;
      }
    }
    if (!tenant) tenant = getDefaultTenant();
    try {
      return await runInTenantContext(tenant, () => (handler as LiffRouteHandler)(req, ctx, verifiedLineUserId));
    } catch (e) {
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setTag('tenant_id', tenant!.id);
          scope.setTag('tenant_name', tenant!.name);
          scope.setTag('error_source', 'withLiffTenant');
          Sentry.captureException(e);
        });
      }
      throw e;
    }
  };
}

/** マスタ専用ルート（テナント管理など）。env ADMIN_EMAIL のみ通す */
export function withMasterOnly(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySession(cookieValue);
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'master only' }, { status: 403 });
    }
    return handler(req, ctx);
  };
}

export function currentSession(req: NextRequest): SessionPayload | null {
  return verifySession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * テナントIDを直接指定してコンテキストを設定するラッパー（公開APIのリデーム等で使用）
 * 認証は別途呼び出し元で処理すること。
 */
export async function runWithTenantById<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  let tenant;
  try {
    tenant = (await getTenantByIdAsync(tenantId)) || getDefaultTenant();
  } catch {
    tenant = getDefaultTenant();
  }
  return runInTenantContext(tenant, fn);
}
