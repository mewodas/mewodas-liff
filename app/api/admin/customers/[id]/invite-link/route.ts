import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { createInviteToken } from '@/lib/inviteToken';
import { getCustomer } from '@/lib/repository/customers';
import { fetchOfficialLineUrl } from '@/lib/lineBot';
import { getSeatStatus } from '@/lib/seats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  // 席数上限チェック
  const seatStatus = await getSeatStatus();
  if (seatStatus.isOverLimit) {
    return NextResponse.json(
      { error: 'seat_limit_reached', seatLimit: seatStatus.seatLimit, currentSeats: seatStatus.currentSeats },
      { status: 403 }
    );
  }

  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const tenant = getCurrentTenant();
  const token = createInviteToken({ customerId: id, tenantId: tenant.id });
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fitmeal.jp';
  // LIFF Endpoint URL は `/home` を指す運用のため、`liff.line.me/<ID>/onboard` で
  // 渡すと `/home/onboard` に解決されて 404 になる。/onboard ページ自体が
  // `liff.init()` + `liff.login()` を内包しているので、直接 URL で誘導する。
  const url = `${base}/onboard?token=${token}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // 顧客に送るための定型文（招待リンクのみ・パターンB）
  // 公式LINE 追加は /onboard 完了画面で誘導するため、ここでは含めない
  const shareText = `${customer.name ? customer.name + ' 様\n\n' : ''}下記をタップして食事管理プログラムへのアカウント認証を完了してください 👇

${url}

連携完了後、画面の案内に従って公式LINEを友だち追加していただくと、リッチメニューから食事管理のURLにアクセス可能です。

ご不明な点はお気軽にお問い合わせください 🙌`;

  return NextResponse.json({ url, token, expiresAt, shareText });
});
