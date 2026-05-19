import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // SAMEORIGIN (not DENY) because LIFF runs inside LINE WebView
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // camera needed for meal-photo capture in LIFF
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  // staging で enforce 検証中。問題なければ main にも同じ enforce で展開
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      // LIFF SDK: static.line-scdn.net + liffsdk.line-scdn.net 等のサブドメイン許容のため wildcards
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.line-scdn.net https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      // LIFF SDK は api.line.me 以外に access.line.me / liff-subwindow.line.me / uts-front.line-apps.com も叩く
      "connect-src 'self' https://*.line.me https://*.line-apps.com https://api.notion.com https://generativelanguage.googleapis.com https://o*.ingest.sentry.io https://va.vercel-scripts.com",
      "frame-src 'self' https://*.line.me",
      "font-src 'self' data:",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/store/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT || 'fitmeal',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  // DSN 未設定時はソースマップ送信をスキップ
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
