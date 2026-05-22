import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listTenantRows, updateTenantRow } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  try {
    const { channelToken } = await req.json();
    if (!channelToken || typeof channelToken !== 'string') {
      return NextResponse.json({ error: 'channelToken 必須' }, { status: 400 });
    }

    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${channelToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `LINE API エラー (${res.status}): ${text.slice(0, 200)}` },
        { status: 400 }
      );
    }
    const data = (await res.json()) as {
      userId?: string;
      basicId?: string;
      premiumId?: string | null;
      displayName?: string;
      pictureUrl?: string;
    };

    const lineId = data.premiumId || data.basicId;
    const officialLineUrl = lineId
      ? `https://line.me/R/ti/p/${encodeURIComponent(lineId)}`
      : null;

    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    await updateTenantRow(row.pageId, {
      lineChannelToken: channelToken,
      ...(officialLineUrl ? { officialLineUrl } : {}),
    });
    invalidateTenantCache();

    return NextResponse.json({
      ok: true,
      botName: data.displayName ?? null,
      basicId: data.basicId ?? null,
      pictureUrl: data.pictureUrl ?? null,
      officialLineUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
