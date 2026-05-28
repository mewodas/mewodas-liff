import { redirect } from 'next/navigation';

// LIFF Endpoint URL が /home 配下のため、リッチメニュー等の
// liff.line.me/{liffId}/{path} は /home/{path} に解決され、該当ルートが
// 無いと 404 になる（既知の再発パターン）。未知の /home 配下パスは
// クエリを保持したままホームへ寄せる。明示ルート(onboard/register 等)が優先。
export default async function HomeCatchAll({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(query ? `/home?${query}` : '/home');
}
