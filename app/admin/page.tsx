import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export default async function AdminRootPage() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(cookieValue);

  if (!session) {
    redirect('/admin/login');
  }

  // 初期表示は顧客設定（/admin/customers）
  redirect('/admin/customers');
}
