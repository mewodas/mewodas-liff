import { redirect } from 'next/navigation';

// 招待トークン引き換えは `/home/onboard` に移管された
// （LIFF Endpoint URL が `/home` のため OAuth redirect_uri が `/home/...` でないと 400）。
// このページは 2026-05-18 中に発行された旧フォーマット
// `https://app.fitmeal.jp/onboard?token=...` の後方互換のために token を保持して転送する。
export default async function OnboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';
  const target = token ? `/home/onboard?token=${encodeURIComponent(token)}` : '/home/onboard';
  redirect(target);
}
