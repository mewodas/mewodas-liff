// パスワード再設定（公開エンドポイント、認証不要）
//
// セキュリティ:
// - メール列挙攻撃を防ぐため、テナント未発見でも 200 を返す
// - 同一メール宛は60秒に1回までのレート制限
// - パスワードは自動生成のみ（攻撃者が任意の値を設定できない）

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/adminAuth';
import { setTenantPasswordHash } from '@/lib/notion';
import { findTenantByOwnerEmail, invalidateTenantCache } from '@/lib/tenantResolver';
import { sendEmail, buildMailtoUrl, loginInfoEmail } from '@/lib/email';
import { generatePassword } from '@/lib/passwordGen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 簡易レート制限（プロセス内メモリ、サーバ再起動で消える）
const recentResets = new Map<string, number>();

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

    const password = generatePassword(12);
    const hash = hashPassword(password);
    await setTenantPasswordHash(tenant.pageId, hash);
    invalidateTenantCache();

    const payload = loginInfoEmail({
      tenantName: tenant.tenantName,
      ownerEmail: email,
      password,
    });
    const result = await sendEmail(payload);

    if (result.sent) {
      return NextResponse.json({ ok: true, mailSent: true });
    }
    // RESEND 未設定 → mailto: では公開エンドポイントなので開けない
    // ただしマスタが復旧する手段は残しておく
    return NextResponse.json({
      ok: true,
      mailSent: false,
      reason: result.reason === 'no_provider' ? 'no_provider' : 'error',
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
