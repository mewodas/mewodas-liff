import { NextRequest, NextResponse } from 'next/server';
import {
  verifySession,
  SESSION_COOKIE_NAME,
  hashPassword,
  verifyPassword,
} from '@/lib/adminAuth';
import { listTenantRows, setTenantPasswordHash } from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = verifySession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // tenant_admin のみセルフ変更可能（マスタは env なのでここでは扱わない）
  if (session.role !== 'tenant_admin') {
    return NextResponse.json(
      { error: 'マスタは環境変数 ADMIN_PASSWORD_HASH を直接更新してください' },
      { status: 403 }
    );
  }

  let currentPassword = '';
  let newPassword = '';
  try {
    const body = await req.json();
    currentPassword = String(body.currentPassword || '');
    newPassword = String(body.newPassword || '');
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '現在/新パスワード必須' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: '新しいパスワードは8文字以上必要' }, { status: 400 });
  }

  try {
    // 該当テナント取得
    const all = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const tenant = all.find(
      (t) => t.tenantId === session.currentTenantId && t.ownerEmail?.toLowerCase() === session.email.toLowerCase()
    );
    if (!tenant || !tenant.passwordHash) {
      return NextResponse.json({ error: 'tenant not found or no password set' }, { status: 404 });
    }

    // 現パスワード検証
    if (!verifyPassword(currentPassword, tenant.passwordHash)) {
      return NextResponse.json({ error: '現在のパスワードが違います' }, { status: 401 });
    }

    // 新パスワードでハッシュ更新
    const newHash = hashPassword(newPassword);
    await setTenantPasswordHash(tenant.pageId, newHash);
    invalidateTenantCache();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
