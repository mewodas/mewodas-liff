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

type RouteCtx = { params?: Promise<Record<string, string>> };
type RouteHandler<C extends RouteCtx = RouteCtx> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

/** 管理画面ルート用ラッパー。Cookieセッションからテナント解決→context.run */
export function withAdminTenant<C extends RouteCtx = RouteCtx>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySession(cookieValue);
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const tenantId = session.currentTenantId || 'mewodas';
    const tenant = (await getTenantByIdAsync(tenantId)) || getDefaultTenant();
    return runInTenantContext(tenant, () => handler(req, ctx));
  };
}

/** LIFF（顧客）ルート用ラッパー。X-Liff-Id ヘッダーからテナント解決→context.run */
export function withLiffTenant<C extends RouteCtx = RouteCtx>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    const liffId = req.headers.get('x-liff-id') || '';
    let tenant = null;
    if (liffId) {
      tenant = await resolveTenantByLiffId(liffId);
    }
    // LIFF ID 未提供 or 未登録ならフォールバック（移行期）
    if (!tenant) tenant = getDefaultTenant();
    return runInTenantContext(tenant, () => handler(req, ctx));
  };
}

/** マスタ専用ルート（テナント管理など）。env ADMIN_EMAIL のみ通す */
export function withMasterOnly<C extends RouteCtx = RouteCtx>(handler: RouteHandler<C>): RouteHandler<C> {
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
