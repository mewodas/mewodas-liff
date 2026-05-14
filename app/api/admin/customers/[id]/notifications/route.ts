import { NextResponse } from 'next/server';
import { listNotificationsByLineUser, isNotificationsConfigured } from '@/lib/notifications';
import { getCustomer } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  if (!isNotificationsConfigured()) {
    return NextResponse.json({ configured: false, notifications: [] });
  }
  try {
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) return NextResponse.json({ configured: true, notifications: [] });
    const notifications = await listNotificationsByLineUser(customer.lineUserId, 50);
    return NextResponse.json({ configured: true, notifications, customer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
