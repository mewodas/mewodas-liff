// パスワード再設定（公開エンドポイント、認証不要）
//
// フロー:
//   1. このエンドポイントでメール受領
//   2. テナント検索 → 1時間有効のリセットトークン生成
//   3. https://app.fitmeal.jp/store/account/reset/confirm?token=xxx をメール送信
//   4. ユーザーがリンクから新パスワードを設定（別エンドポイント /confirm）
//
// セキュリティ:
// - メール列挙攻撃を防ぐため、テナント未発見でも 200 を返す
// - 同一メール宛は60秒に1回までのレート制限
// - トークンは HMAC 署名で改ざん検知、期限切れで自動無効化

import { NextRequest, NextResponse } from 'next/server';
import { findTenantByOwnerEmail } from '@/lib/tenantResolver';
import { sendEmail, resetLinkEmail } from '@/lib/email';
import { signResetToken } from '@/lib/passwordReset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 簡易レート制限（プロセス内メモリ、サーバ再起動で消える）
const recentResets = new Map<string, number>();

function originFromRequest(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || 'app.fitmeal.jp';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  let email = '';
  try {
    const body = await req.json();
    email = String(body.email || '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!email || !/^[^@]+@[^@]+$/.test(email)) {
    return NextResponse.json({ error: 'メールアドレス形式不正' }, { status: 400 });
  }

  // レート制限
  const last = recentResets.get(email);
  if (last && Date.now() - last < 60_000) {
    return NextResponse.json({
      ok: true,
      throttled: true,
      message: '少し前に送信済みです。メールが届かない場合は迷惑メールフォルダもご確認ください。',
    });
  }
  recentResets.set(email, Date.now());

  try {
    const tenant = await findTenantByOwnerEmail(email);
    if (!tenant) {
      // 列挙攻撃防止のため成功っぽく返す
      return NextResponse.json({ ok: true });
    }

    const token = signResetToken({ email, tenantId: tenant.tenantId });
    // /store 由来か /admin 由来かを区別したいが、メール経由なのでデフォルトで /store にする
    // （ジム経営者向けのほうが大多数）
    const origin = originFromRequest(req);
    const resetUrl = `${origin}/store/account/reset/confirm?token=${encodeURIComponent(token)}`;

    const payload = resetLinkEmail({
      tenantName: tenant.tenantName,
      ownerEmail: email,
      resetUrl,
    });
    const result = await sendEmail(payload);

    if (result.sent) {
      return NextResponse.json({ ok: true, mailSent: true });
    }
    return NextResponse.json({
      ok: true,
      mailSent: false,
      reason: result.reason === 'no_provider' ? 'no_provider' : 'error',
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
