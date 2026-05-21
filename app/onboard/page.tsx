import { redirect } from 'next/navigation';

// 旧招待トークン方式の後方互換リダイレクト。
// 招待トークン方式は廃止済み。LINEの申し込みフォーム（/home/register）に誘導。
export default async function OnboardRedirect() {
  redirect('/home/register');
}
