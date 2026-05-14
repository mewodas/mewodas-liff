// API ルートをテナントコンテキストでラップするヘルパー
//
// 使い方:
//   export const GET = withAdminTenant(async (req, ctx) => { ... });
//   export const POST = withLiffTenant(async (req) => { ... });

import { NextRequest, NextResponse } from 'next/server';
import { runInTenantContext } from './tenantContext';
import { getTenantByIdAsync, resolveTenantByLiffId } from './tenantResolver';
import { verifySession, SESSION_COOKIE_NAME, type SessionPayload } from './adminAuth';
import { getDefaultTenant } from './tenant';

// Next.js のルートハンドラ第2引数は経路により形が違うため any 受けで通す
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: NextRequest, ctx: any) => Promise<Response> | Response;

/** 管理画面ルート用ラッパー。Cookieセッションからテナント解決→context.run */
export function withAdminTenant(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySession(cookieValue);
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const tenantId = session.currentTenantId || 'mewodas';
    // Notion テナント DB アクセス失敗時はデフォルト（MEWODAS）にフォールバック
    let tenant;
    try {
      tenant = (await getTenantByIdAsync(tenantId)) || getDefaultTenant();
    } catch {
      tenant = getDefaultTenant();
    }
    return runInTenantContext(tenant, () => handler(req, ctx));
  };
}

/** LIFF（顧客）ルート用ラッパー。X-Liff-Id ヘッダーからテナント解決→context.run */
export function withLiffTenant(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const liffId = req.headers.get('x-liff-id') || '';
    let tenant = null;
    if (liffId) {
      try {
        tenant = await resolveTenantByLiffId(liffId);
      } catch {
        tenant = null;
      }
    }
    // LIFF ID 未提供 or 未登録ならフォールバック（移行期）
    if (!tenant) tenant = getDefaultTenant();
    return runInTenantContext(tenant, () => handler(req, ctx));
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
