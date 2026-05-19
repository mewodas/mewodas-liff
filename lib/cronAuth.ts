import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron 用の認証チェック。
 * - CRON_SECRET 未設定 + 本番 → 503 を返す（fail-open 防止）
 * - CRON_SECRET 未設定 + 非本番 → 警告ログを出してスキップを許容
 * - CRON_SECRET 設定済み → Authorization: Bearer <secret> または ?secret=<secret> を照合
 *
 * 認可成功時は null を返す。失敗時は返すべき Response を返す。
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.warn('[cronAuth] CRON_SECRET is not set — skipping auth in non-production environment');
    return null;
  }

  const auth = req.headers.get('authorization') || '';
  // クエリ ?secret= 認証は非本番のみ許可（本番ではアクセスログに secret が平文記録されるリスク）
  const querySecret =
    process.env.NODE_ENV !== 'production'
      ? new URL(req.url).searchParams.get('secret')
      : null;
  const isAuthorized = auth === `Bearer ${cronSecret}` || querySecret === cronSecret;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return null;
}
