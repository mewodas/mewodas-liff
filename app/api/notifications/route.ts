import { NextRequest, NextResponse } from 'next/server';
import { listNotificationsByLineUser, isNotificationsConfigured } from '@/lib/notifications';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  if (!isNotificationsConfigured()) {
    return NextResponse.json({ configured: false, notifications: [], unreadCount: 0 });
  }
  try {
    const notifications = await listNotificationsByLineUser(verifiedLineUserId, 30);
    const unreadCount = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ configured: true, notifications, unreadCount });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
