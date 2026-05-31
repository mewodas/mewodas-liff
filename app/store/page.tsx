import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export default async function StoreRootPage() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(cookieValue);

  if (!session) {
    redirect('/store/login');
  }

  // 初期表示は顧客管理（/store/customers）
  redirect('/store/customers');
}
