// セルフサーブ申込の Stripe Checkout 完了後の着地ページ。
// プロビジョニングは webhook で非同期に走るため、ここでは「受付完了」を案内するのみ。
// 認証なし・公開ページ。

import Link from 'next/link';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

export default async function SignupWelcomePage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === 'string'
      ? params.session_id
      : Array.isArray(params.session_id)
        ? params.session_id[0]
        : null;

  return (
    <Suspense fallback={null}>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-emerald-100">
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                ✓
              </span>
              <h1 className="text-2xl font-bold text-slate-900">
                ご登録ありがとうございます
              </h1>
            </div>

            <p className="mb-4 text-slate-700">
              FitMeal の申込みを受け付けました。アカウントを発行しています。
              <br />
              <strong>数分以内に、登録メールアドレス宛にログイン情報をお送りします。</strong>
            </p>

            <div className="my-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="mb-2 font-semibold">次のステップ</p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>受信したメールに記載のログインURL・初期パスワードでログイン</li>
                <li>
                  ガイドに沿って LINE 公式アカウントと FitMeal を連携（約15分）
                </li>
                <li>初回の会員様を招待してご利用開始</li>
              </ol>
            </div>

            <div className="my-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-1 font-semibold">14日間 無料トライアル中</p>
              <p>
                トライアル期間中は¥0です。期間内にいつでも解約でき、その場合課金は発生しません。
                トライアル終了後、入力いただいたカードに自動で初回請求が行われます。
              </p>
            </div>

            <p className="text-sm text-slate-500">
              ※メールが届かない場合は迷惑メールフォルダをご確認のうえ、
              <a className="text-emerald-700 underline" href="mailto:support@fitmeal.jp">
                support@fitmeal.jp
              </a>{' '}
              までご連絡ください。
            </p>

            {sessionId && (
              <p className="mt-4 break-all text-xs text-slate-400">
                Reference: {sessionId}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="https://help.fitmeal.jp/onboarding.html"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700"
              >
                オンボーディングガイドを見る
              </Link>
              <Link
                href="https://fitmeal.jp"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                サービスサイトへ戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
    </Suspense>
  );
}
