import { NextRequest, NextResponse } from 'next/server';
import { markNotificationRead, isNotificationsConfigured } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isNotificationsConfigured()) {
    return NextResponse.json({ error: 'notifications_not_configured' }, { status: 503 });
  }
  try {
    const { id } = await params;
    await markNotificationRead(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
