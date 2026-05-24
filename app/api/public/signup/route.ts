// セルフサーブ申込エンドポイント (公開・認証なし)
//
// フロー:
//   LP fitmeal.jp の申込フォーム
//     → POST /api/public/signup (このファイル)
//     → Stripe Checkout Session 作成 (trial 14日 / payment_method_collection: always)
//     → Checkout URL を返す
//     → フロントが location.href でリダイレクト
//     → Stripe 決済完了
//     → webhook checkout.session.completed が provisionTenant() を呼びテナント自動発行
//
// 設計: docs/SELFSERVE_SIGNUP_DESIGN.md (Phase 1)
//
// セキュリティ:
//   - CORS: fitmeal.jp とそのサブドメイン + staging (preview) を許可
//   - honeypot: _gotcha フィールドに値が入っていれば 200 で破棄 (bot 識別)
//   - rate limit: 1 IP/分 3 件 (in-memory・既存 /api/public/apply と同様)
//   - 実プロビジョニングは Stripe 決済完了 webhook 経由 → カード未入力の bot 投稿に被害なし

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, buildSubscriptionLineItems } from '@/lib/stripe';
import { getPlanByCode } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 許可オリジン (CORS)
const ALLOWED_ORIGINS = [
  'https://fitmeal.jp',
  'https://www.fitmeal.jp',
  // Vercel preview / 開発時に必要なら拡張
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

// Simple in-memory rate limit: 1 IP につき 1 分間に 3 件まで
type RateRecord = { count: number; windowStart: number };
const rateMap = new Map<string, RateRecord>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  // map サイズ膨張防止: 1万 entry を超えたら期限切れエントリをまとめて掃除
  if (rateMap.size > 10_000) {
    const cutoff = now - RATE_WINDOW_MS;
    for (const [key, val] of rateMap) {
      if (val.windowStart < cutoff) rateMap.delete(key);
    }
  }
  const rec = rateMap.get(ip);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (rec.count >= RATE_MAX) {
    return { ok: false, retryAfter: Math.ceil((rec.windowStart + RATE_WINDOW_MS - now) / 1000) };
  }
  rec.count++;
  return { ok: true };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  // レートリミット
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。少し待ってから再度お試しください' },
      { status: 429, headers: { ...cors, 'Retry-After': String(limit.retryAfter || 60) } }
    );
  }

  try {
    const body = await req.json();

    // honeypot: _gotcha に値があれば bot とみなして 200 で破棄 (動作完了に偽装)
    const honeypot = String(body._gotcha || '').trim();
    if (honeypot) {
      return NextResponse.json({ ok: true, skipped: true }, { headers: cors });
    }

    // Stripe metadata は 500 文字制限。100 文字で十分以上のバッファ。
    const gymName = String(body.gymName || '').trim().slice(0, 100);
    const ownerName = String(body.ownerName || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().slice(0, 200);
    const phone = String(body.phone || '').trim().slice(0, 20);
    const headcountRaw = body.headcount;
    // 上限 500: bot が巨大な quantity を Stripe に投げて法外な金額を表示するのを防ぐ。
    // 標準プラン Volume 段階 (1650/人) 想定で 500 人なら ¥825,000/月。それ以上は要相談扱い。
    const headcount = Math.min(500, Math.max(1, Math.floor(Number(headcountRaw) || 5)));

    if (!gymName) {
      return NextResponse.json({ error: 'ジム名は必須です' }, { status: 400, headers: cors });
    }
    if (!ownerName) {
      return NextResponse.json({ error: 'お名前は必須です' }, { status: 400, headers: cors });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'メールアドレスの形式が正しくありません' },
        { status: 400, headers: cors }
      );
    }
    if (!Number.isFinite(headcount) || headcount <= 0) {
      return NextResponse.json(
        { error: '顧客数は正の整数で入力してください' },
        { status: 400, headers: cors }
      );
    }

    // 標準プラン取得
    const plan = await getPlanByCode('standard');
    if (!plan) {
      return NextResponse.json(
        { error: '料金プランが取得できませんでした。サポートまでご連絡ください' },
        { status: 500, headers: cors }
      );
    }

    // 最小席数を満たすよう自動引き上げ (LP は概算入力なので強制エラーにせず吸収)
    const seats = Math.max(headcount, plan.minSeats);
    const lineItems = buildSubscriptionLineItems(plan, seats);

    const stripe = getStripe();
    const successOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    // success_url は本番アプリドメインに固定する。req.nextUrl.origin だと Vercel preview URL
    // (xxx.vercel.app) や staging.fitmeal.jp に誘導されてしまう。
    // staging では NEXT_PUBLIC_APP_URL=https://staging.fitmeal.jp、本番では未設定でデフォルト。
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (req.nextUrl.hostname.includes('staging') ? 'https://staging.fitmeal.jp' : 'https://app.fitmeal.jp');

    const metadata: Record<string, string> = {
      selfServe: 'true',
      gymName,
      ownerName,
      headcount: String(headcount),
      seats: String(seats),
      planCode: plan.planCode,
    };
    if (phone) metadata.phone = phone;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'ja',
      customer_email: email,
      line_items: lineItems,
      payment_method_collection: 'always',
      success_url: `${appOrigin}/signup/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${successOrigin}/#cta`,
      metadata,
      subscription_data: {
        trial_period_days: 14,
        metadata,
      },
    });

    return NextResponse.json(
      { ok: true, url: session.url, sessionId: session.id },
      { headers: cors }
    );
  } catch (e) {
    console.error('public/signup 失敗:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'サーバーエラー' },
      { status: 500, headers: cors }
    );
  }
}
