import { NextRequest, NextResponse } from 'next/server';
import { listNotificationsByLineUser, isNotificationsConfigured } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) return NextResponse.json({ error: 'lineUserId required' }, { status: 400 });
  if (!isNotificationsConfigured()) {
    return NextResponse.json({ configured: false, notifications: [], unreadCount: 0 });
  }
  try {
    const notifications = await listNotificationsByLineUser(lineUserId, 30);
    const unreadCount = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ configured: true, notifications, unreadCount });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
