import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';

// CSRF 対策: Cookie セッション認証の状態変更は同一オリジンからのみ許可する。
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false; // ブラウザの状態変更リクエストは Origin を必ず送る。欠落は拒否。
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isStore = pathname.startsWith('/store') || pathname.startsWith('/api/store');
  if (!isAdmin && !isStore) {
    return NextResponse.next();
  }

  // CSRF: /admin・/store の状態変更（POST/PUT/PATCH/DELETE）は同一オリジン必須。
  //   Cookie 認証のため外部サイト起点の強制リクエストを Origin 照合で拒否する。
  //   顧客 LIFF(/api/record 等)は Bearer 認証で CSRF 非該当、Stripe webhook/cron は別パス・別認証。
  if (MUTATING_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: 'csrf_origin_mismatch' }, { status: 403 });
  }

  // ログイン・パスワード再設定ページとAPIは素通し（未ログイン状態で必要）
  if (
    pathname === '/admin/login' ||
    pathname === '/store/login' ||
    pathname === '/admin/account/reset' ||
    pathname === '/store/account/reset' ||
    pathname === '/admin/account/reset/confirm' ||
    pathname === '/store/account/reset/confirm' ||
    pathname === '/api/admin/auth/login' ||
    pathname === '/api/admin/auth/reset-password' ||
    pathname === '/api/admin/auth/reset-password/confirm'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(token);

  if (!session) {
    // API はJSON 401で返す
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // ページは /admin/login or /store/login にリダイレクト
    const loginPath = pathname.startsWith('/store') ? '/store/login' : '/admin/login';
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 全パスにマッチ
     * - 認可チェックは /admin /store /api/admin /api/store のみだが、将来追加に備えて全パスを受ける
     */
    '/(.*)',
  ],
};
