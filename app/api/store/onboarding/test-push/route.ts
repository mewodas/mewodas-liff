import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (_req: NextRequest) => {
  try {
    const tenantId = getCurrentTenant().id;
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const row = rows.find((r) => r.tenantId === tenantId);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    if (!row.lineChannelToken) {
      return NextResponse.json({ error: 'LINE Channel Token が未設定です' }, { status: 400 });
    }
    if (!row.ownerLineUserId) {
      return NextResponse.json({ error: 'オーナーの LINE User ID が未取得です。テストリンクを開いてください。' }, { status: 400 });
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${row.lineChannelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: row.ownerLineUserId,
        messages: [
          {
            type: 'text',
            text: `FitMeal のセットアップが完了しました！\n\n${row.name} のリッチメニューが有効になっています。このメッセージが届いていれば LINE 連携は正常に動作しています。`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `メッセージ送信失敗 (${res.status}): ${text.slice(0, 200)}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
