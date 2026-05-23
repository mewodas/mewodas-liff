import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/adminAuth';
import { getTenantByIdAsync } from '@/lib/tenantResolver';
import { getDefaultTenant } from '@/lib/tenant';
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

  try {
    const tenantId = session.currentTenantId || 'mewodas';
    let tenant;
    try {
      tenant = (await getTenantByIdAsync(tenantId)) || getDefaultTenant();
    } catch {
      tenant = getDefaultTenant();
    }

    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenant.id) as (typeof rows[0] & { onboardingCompletedAt?: string | null }) | undefined;
    const onboardingCompletedAt = row?.onboardingCompletedAt ?? null;

    if (onboardingCompletedAt) {
      redirect('/store/progress');
    } else {
      redirect('/store/customers');
    }
  } catch {
    redirect('/store/progress');
  }
}
