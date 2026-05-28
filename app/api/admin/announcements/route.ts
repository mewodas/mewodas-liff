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

    // ロールはセッションから、テナントIDは確立済みコンテキストから取得。
    // コンテキストは withAdminTenant で解決済み（staging の FITMEAL_TENANT_ID_OVERRIDE も反映）。
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
      // 運営（master）: audience・対象テナントはリクエスト値を信頼する
      audience = (body.audience as AnnouncementAudience) || '顧客向け';
      const scope: string = body.scope || 'all';
      if (scope === 'tenant' && body.targetTenantId) {
        targetTenants = [String(body.targetTenantId)];
      } else {
        // 'all' または 店舗向け = 対象テナント空（全テナント共通）
        targetTenants = [];
      }
    } else {
      // 店舗（tenant_admin）: audience を強制的に '顧客向け'、対象テナントを自テナントに固定
      // クライアント値は一切信用しない
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
