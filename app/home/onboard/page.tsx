import { redirect } from 'next/navigation';

// 招待トークン方式は廃止。自己登録（/home/register）に移行済み。
export default function HomeOnboardPage() {
  redirect('/home/register');
}
