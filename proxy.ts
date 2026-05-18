import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';

const STAGING_HOSTS = [
  'staging.fitmeal.jp',
];

const PASSTHROUGH_HOSTS = [
  'app.fitmeal.jp',
  'fitmeal.jp',
  'www.fitmeal.jp',
  'localhost',
];

function isStagingHost(host: string): boolean {
  if (PASSTHROUGH_HOSTS.some((h) => host === h || host.startsWith(h + ':'))) {
    return false;
  }
  if (STAGING_HOSTS.some((h) => host === h || host.startsWith(h + ':'))) {
    return true;
  }
  // *.vercel.app および *-mewodas-projects.vercel.app
  if (host.endsWith('.vercel.app') || host.includes('.vercel.app:')) {
    return true;
  }
  return false;
}

function basicAuthResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="FitMeal Staging"',
    },
  });
}

function checkBasicAuth(request: NextRequest): boolean {
  const user = process.env.STAGING_BASIC_AUTH_USER;
  const pass = process.env.STAGING_BASIC_AUTH_PASSWORD;
  if (!user || !pass) return true;

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;

  const encoded = authHeader.slice(6);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const colon = decoded.indexOf(':');
  if (colon === -1) return false;
  const reqUser = decoded.slice(0, colon);
  const reqPass = decoded.slice(colon + 1);
  return reqUser === user && reqPass === pass;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';

  // Basic Auth ガード（staging / preview のみ）
  // 目的: LIFF顧客側ページの非公開化。/admin /store は独自の scrypt+Cookie 認証で守られているため除外する
  // （fetch() / RSC fetch はブラウザが Basic Auth ヘッダーを自動付与せず、ログイン後の遷移でダイアログが再表示されるため）
  if (isStagingHost(host)) {
    const isCronPath = pathname.startsWith('/api/cron/');
    const isStaticAsset =
      pathname.startsWith('/_next/static/') ||
      pathname === '/favicon.ico' ||
      // Next.js metadata files（app/icon.svg, app/apple-icon.png, app/opengraph-image.* など）は
      // ブラウザがページ読み込み時に自動取得する。Basic Auth 401 を返すと WWW-Authenticate に応じてダイアログが再表示されるため除外
      /^\/(icon|apple-icon|opengraph-image|twitter-image)(-\w+)?\.(svg|png|jpg|jpeg|ico)$/.test(pathname) ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml';
    const isAdminOrStore =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/store') ||
      pathname.startsWith('/api/admin') ||
      pathname.startsWith('/api/store');

    if (!isCronPath && !isStaticAsset && !isAdminOrStore) {
      if (!checkBasicAuth(request)) {
        return basicAuthResponse();
      }
    }
  }

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
     * 全パスにマッチ（ただし Next.js 内部の _next/data は除外しない — セキュリティ上意図的）
     * - _next/static と favicon.ico は proxy 内で素通しするが matcher には含める
     */
    '/(.*)',
  ],
};
