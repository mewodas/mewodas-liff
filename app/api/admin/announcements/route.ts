import { NextResponse } from 'next/server';
import {
  createAnnouncement,
  listAllAnnouncementsAdmin,
  isAnnouncementsConfigured,
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
  // 店舗向けのみ返す（顧客向けは過去データ混入防止のため除外）
  announcements = announcements.filter((a) => a.audience === '店舗向け');
  if (!isMaster) {
    // 店舗は「自テナント宛 or 全テナント共通」のお知らせのみ閲覧（他店舗のお知らせを隠す）
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

    // お知らせ送信は運営(master)専用。店舗(tenant_admin)は受信のみで送信不可。
    const session = currentSession(req);
    const isMaster = session?.role === 'master';
    if (!isMaster) {
      return NextResponse.json({ error: 'お知らせ送信は運営専用です' }, { status: 403 });
    }

    const title = String(body.title || '').trim();
    const bodyText = String(body.body || '').trim();
    const importance = ((body.importance as AnnouncementImportance) || '通常') as AnnouncementImportance;
    const pinned = !!body.pinned;

    if (!title || !bodyText) {
      return NextResponse.json({ error: 'title / body が必要' }, { status: 400 });
    }

    // 宛先は店舗向け固定（顧客向け一斉は廃止）。対象テナントはリクエスト値（全店舗 or 特定店舗）。
    const audience: AnnouncementAudience = '店舗向け';
    let targetTenants: string[];
    const scope: string = body.scope || 'all';
    if (scope === 'tenant' && body.targetTenantId) {
      targetTenants = [String(body.targetTenantId)];
    } else {
      targetTenants = [];
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
