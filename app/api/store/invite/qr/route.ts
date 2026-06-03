import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { withAdminTenant, currentSession } from '@/lib/withTenant';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 店舗の LINE 公式アカウント友だち追加URLを QR コード（SVG）で返す。
// 店頭ポスター・配布用に印刷できるよう、外部サービスに依存せずサーバーで生成する。
export const GET = withAdminTenant(async (req: NextRequest) => {
  try {
    const session = currentSession(req);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    const inviteUrl = row?.officialLineUrl ?? null;
    if (!inviteUrl) {
      return NextResponse.json({ error: 'invite_url_not_ready' }, { status: 404 });
    }

    const svg = await QRCode.toString(inviteUrl, {
      type: 'svg',
      margin: 1,
      width: 480,
      color: { dark: '#1c1917', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
