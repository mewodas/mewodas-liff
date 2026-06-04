import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function StoreRootPage() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(cookieValue);

  if (!session) {
    redirect('/store/login');
  }

  // 初回ログイン（オンボーディング未完了）の店舗はスタートガイド(/store/start)へ誘導。
  // 連携完了後は通常どおり顧客管理へ。master(運営)はオンボ対象外なので素通り。
  // ※ redirect() は例外を投げるので try の外で呼ぶ。Notion 取得失敗時は顧客管理にフォールバック。
  let target = '/store/customers';
  if (session.role === 'tenant_admin') {
    try {
      const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
      const row = rows.find((r) => r.tenantId === session.currentTenantId);
      if (row && !row.onboardingCompletedAt) target = '/store/start';
    } catch {
      // フォールバック: 顧客管理へ
    }
  }
  redirect(target);
}
