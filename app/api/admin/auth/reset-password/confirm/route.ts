// パスワード再設定の最終ステップ（公開エンドポイント、トークン認証）
// メールリンクからのアクセス前提。

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/adminAuth';
import { setTenantPasswordHash, listTenantRows } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { sendEmail, resetCompletedEmail } from '@/lib/email';
import { verifyResetToken } from '@/lib/passwordReset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let token = '';
  let newPassword = '';
  try {
    const body = await req.json();
    token = String(body.token || '');
    newPassword = String(body.newPassword || '');
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上必要' }, { status: 400 });
  }

  const verified = verifyResetToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: 'リンクが無効または有効期限切れです。再度パスワード再設定をリクエストしてください。' },
      { status: 401 }
    );
  }

  try {
    // テナント存在確認
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const tenant = all.find(
      (t) =>
        t.tenantId === verified.tenantId &&
        t.ownerEmail?.toLowerCase() === verified.email.toLowerCase() &&
        t.status !== '解約'
    );
    if (!tenant) {
      return NextResponse.json({ error: 'tenant not found or 解約済み' }, { status: 404 });
    }

    // パスワード保存
    const hash = hashPassword(newPassword);
    await setTenantPasswordHash(tenant.pageId, hash);
    invalidateTenantCache();

    // 完了通知メール（任意、失敗してもパスワード更新は成功扱い）
    let mailSent = false;
    try {
      const result = await sendEmail(
        resetCompletedEmail({
          tenantName: tenant.name,
          ownerEmail: verified.email,
        })
      );
      mailSent = result.sent;
    } catch {
      // 通知メール失敗は無視
    }

    return NextResponse.json({ ok: true, mailSent });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
