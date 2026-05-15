import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/adminAuth';
import { listTenantRows, setTenantPasswordHash } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { sendEmail, loginInfoEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function genPassword(length = 12): string {
  // 紛らわしい文字（O/0, I/l/1）を除外
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

export const POST = withMasterOnly(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || ''); // 'set' or 'generate'
    const sendMail = body.sendMail !== false; // 既定 true

    // tenant pageId 解決
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const tenant = all.find((t) => t.pageId === id || t.tenantId === id);
    if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });

    let password = '';
    if (action === 'generate') {
      password = genPassword(12);
    } else {
      password = String(body.password || '');
      if (password.length < 8) {
        return NextResponse.json({ error: 'パスワードは8文字以上必要' }, { status: 400 });
      }
    }

    const hash = hashPassword(password);
    await setTenantPasswordHash(tenant.pageId, hash);
    invalidateTenantCache();

    // メール送信（オーナーメール設定済みかつ送信希望時）
    let mail: { sent: boolean; reason?: string; mailtoUrl?: string; error?: string } = { sent: false };
    if (sendMail && tenant.ownerEmail) {
      const payload = loginInfoEmail({
        tenantName: tenant.name,
        ownerEmail: tenant.ownerEmail,
        password,
      });
      const result = await sendEmail(payload);
      if (result.sent) {
        mail = { sent: true };
      } else if (result.reason === 'no_provider') {
        const { buildMailtoUrl } = await import('@/lib/email');
        mail = { sent: false, reason: 'no_provider', mailtoUrl: buildMailtoUrl(payload) };
      } else {
        mail = { sent: false, reason: 'error', error: result.error };
      }
    }

    return NextResponse.json({
      ok: true,
      // generate 時のみ平文を返す（マスタが控える用）
      password: action === 'generate' ? password : undefined,
      ownerEmail: tenant.ownerEmail,
      tenantName: tenant.name,
      mail,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
