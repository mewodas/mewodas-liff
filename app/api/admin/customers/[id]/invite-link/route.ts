import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { createInviteToken } from '@/lib/inviteToken';
import { getCustomer } from '@/lib/repository/customers';
import { fetchOfficialLineUrl } from '@/lib/lineBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const tenant = getCurrentTenant();
  const token = createInviteToken({ customerId: id, tenantId: tenant.id });
  const liffId = tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fitmeal.jp';
  const url = liffId
    ? `https://liff.line.me/${liffId}/onboard?token=${token}`
    : `${base}/onboard?token=${token}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // 顧客に送るための定型文（招待リンクのみ・パターンB）
  // 公式LINE 追加は /onboard 完了画面で誘導するため、ここでは含めない
  const shareText = `【FitMeal 食事管理プログラム】

${customer.name ? customer.name + ' 様\n\n' : ''}下記をタップしてアカウント連携を完了してください 👇

${url}

連携完了後、画面の案内に従って公式LINEを友だち追加していただくと、リッチメニューから FitMeal にアクセスできるようになります。

ご不明な点はお気軽にお問い合わせください 🙌`;

  return NextResponse.json({ url, token, expiresAt, shareText });
});
