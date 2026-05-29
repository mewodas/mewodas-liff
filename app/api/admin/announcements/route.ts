import { NextResponse } from 'next/server';
import {
  createAnnouncement,
  listAllAnnouncementsAdmin,
  isAnnouncementsConfigured,
  getAnnouncementById,
  deleteAnnouncement,
  type AnnouncementAudience,
  type AnnouncementImportance,
} from '@/lib/announcements';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async (req) => {
  if (!isAnnouncementsConfigured()) {
    return NextResponse.json({ configured: false, announcements: [] });
  }
  const session = currentSession(req);
  const isMaster = session?.role === 'master';
  let announcements = await listAllAnnouncementsAdmin();
  if (!isMaster) {
    const tenantId = getCurrentTenant().id;
    announcements = announcements.filter(
      (a) => a.targetTenants.length === 0 || a.targetTenants.includes(tenantId)
    );
  }
  return NextResponse.json({ configured: true, announcements });
});

export const POST = withAdminTenant(async (req) => {
  if (!isAnnouncementsConfigured()) {
    return NextResponse.json(
      { error: 'NOTION_ANNOUNCEMENTS_DB_ID 未設定（お知らせDBを作成して環境変数を設定してください）' },
      { status: 503 }
    );
  }
  try {
    const body = await req.json();

    const session = currentSession(req);
    const isMaster = session?.role === 'master';
    const contextTenantId = getCurrentTenant().id;

    const title = String(body.title || '').trim();
    const bodyText = String(body.body || '').trim();
    const importance = ((body.importance as AnnouncementImportance) || '通常') as AnnouncementImportance;
    const pinned = !!body.pinned;

    if (!title || !bodyText) {
      return NextResponse.json({ error: 'title / body が必要' }, { status: 400 });
    }

    let audience: AnnouncementAudience;
    let targetTenants: string[];

    if (isMaster) {
      audience = (body.audience as AnnouncementAudience) || '顧客向け';
      const scope: string = body.scope || 'all';
      if (scope === 'tenant' && body.targetTenantId) {
        targetTenants = [String(body.targetTenantId)];
      } else {
        targetTenants = [];
      }
    } else {
      audience = '顧客向け';
      targetTenants = [contextTenantId];
    }

    const announcement = await createAnnouncement({
      title,
      body: bodyText,
      audience,
      importance,
      pinned,
      targetTenants,
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const DELETE = withAdminTenant(async (req) => {
  if (!isAnnouncementsConfigured()) {
    return NextResponse.json({ error: 'NOTION_ANNOUNCEMENTS_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id') || '';
    if (!id) {
      try {
        const b = await req.json();
        id = String(b?.id || '');
      } catch {
        /* body 無しは許容 */
      }
    }
    if (!id) return NextResponse.json({ error: 'id が必要' }, { status: 400 });

    const session = currentSession(req);
    const isMaster = session?.role === 'master';

    const ann = await getAnnouncementById(id);
    if (!ann) return NextResponse.json({ error: 'お知らせが見つかりません' }, { status: 404 });

    // 店舗(非master)は自テナント宛のお知らせのみ削除可。全テナント一斉(運営発)は弾く。
    if (!isMaster) {
      const tenantId = getCurrentTenant().id;
      if (!ann.targetTenants.includes(tenantId)) {
        return NextResponse.json(
          { error: 'このお知らせを削除する権限がありません' },
          { status: 403 }
        );
      }
    }

    await deleteAnnouncement(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
