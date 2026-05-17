import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { createInviteToken } from '@/lib/inviteToken';
import { getCustomer } from '@/lib/repository/customers';

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

  // 顧客に送るための定型文（公式LINE友達追加 + 招待リンクをまとめてコピー）
  // テナントDBの「公式LINE URL」を優先、未設定なら env フォールバック
  const officialLineUrl = tenant.officialLineUrl || process.env.OFFICIAL_LINE_URL || '';
  const step1Line = officialLineUrl
    ? `▼ STEP 1: 公式LINEを友だち追加\n${officialLineUrl}\n\n`
    : '';
  const shareText = `【FitMeal 食事管理プログラム】

${customer.name ? customer.name + ' 様\n\n' : ''}下記を順番にタップしてください 👇

${step1Line}▼ ${step1Line ? 'STEP 2' : 'STEP 1'}: 食事管理アプリを開始
${url}

タップしてアカウント連携が完了すると、すぐにご利用いただけます。
ご不明な点はお気軽にお問い合わせください 🙌`;

  return NextResponse.json({ url, token, expiresAt, shareText });
});
