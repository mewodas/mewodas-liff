import { NextRequest, NextResponse } from 'next/server';
import { listAnnouncements, isAnnouncementsConfigured } from '@/lib/announcements';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withLiffTenant(async (_req: NextRequest) => {
  if (!isAnnouncementsConfigured()) {
    return NextResponse.json({ configured: false, announcements: [] });
  }
  try {
    const announcements = await listAnnouncements();
    return NextResponse.json({ configured: true, announcements });
  } catch (e) {
    console.error('[/api/announcements] failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'error' },
      { status: 500 }
    );
  }
});
