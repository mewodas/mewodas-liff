// デモトークン発行エンドポイント（公開・認証なし）
//
// デモ用テナント/ユーザーは env で設定:
//   DEMO_TENANT_ID     - デモテナントID（未設定時は "mewodas-staging"）
//   DEMO_LINE_USER_ID  - デモ顧客の LINE userId（未設定時はデモ準備中を返す）
//
// セキュリティ:
//   - 秘密鍵はサーバー側のみで使用（トークンはサーバー署名済み）
//   - レートリミット: 1 IP / 分 10 件
//   - CORS: fitmeal.jp 系 + staging を許可

import { NextRequest, NextResponse } from 'next/server';
import { generateDemoToken } from '@/lib/demoSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ORIGINS = [
  'https://fitmeal.jp',
  'https://www.fitmeal.jp',
  'https://app.fitmeal.jp',
  'https://staging.fitmeal.jp',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))
      ? origin
      : ALLOWED_ORIGINS[2];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

type RateRecord = { count: number; windowStart: number };
const rateMap = new Map<string, RateRecord>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateMap.size > 10_000) {
    const cutoff = now - RATE_WINDOW_MS;
    for (const [key, val] of rateMap) {
      if (val.windowStart < cutoff) rateMap.delete(key);
    }
  }
  const rec = rateMap.get(ip);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= RATE_MAX) return false;
  rec.count++;
  return true;
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { ...cors, 'Retry-After': '60' } }
    );
  }

  const tenantId = process.env.DEMO_TENANT_ID;
  const lineUserId = process.env.DEMO_LINE_USER_ID;

  if (!tenantId || !lineUserId) {
    return NextResponse.json(
      { error: 'demo_not_ready', message: 'デモは準備中です。しばらくお待ちください。' },
      { status: 503, headers: cors }
    );
  }

  try {
    const token = generateDemoToken({ tenantId, lineUserId });
    return NextResponse.json({ token, tenantId }, { headers: cors });
  } catch (e) {
    console.error('[demo/start] token generation failed:', e);
    return NextResponse.json(
      { error: 'server_error', message: 'デモトークンの生成に失敗しました。' },
      { status: 500, headers: cors }
    );
  }
}
