import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isStore = pathname.startsWith('/store') || pathname.startsWith('/api/store');
  if (!isAdmin && !isStore) {
    return NextResponse.next();
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
