import { NextRequest, NextResponse } from 'next/server';
import { markNotificationRead, isNotificationsConfigured } from '@/lib/notifications';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withLiffTenant(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  verifiedLineUserId: string
) => {
  if (!isNotificationsConfigured()) {
    return NextResponse.json({ error: 'notifications_not_configured' }, { status: 503 });
  }
  try {
    const { id } = await params;
    await markNotificationRead(id, verifiedLineUserId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: msg.startsWith('forbidden:') ? 403 : 500 });
  }
});
