import { redirect } from 'next/navigation';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const liffState = sp['liff.state'];
  if (typeof liffState === 'string' && liffState.length > 0) {
    redirect(liffState);
  }
  redirect('/home');
}
