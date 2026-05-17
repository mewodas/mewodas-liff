import { NextRequest, NextResponse } from 'next/server';
import {
  listTenantRows,
  createTenantCustomerDb,
  createTenantFoodDb,
  createTenantWeightDb,
  insertTenantRow,
  setTenantPasswordHash,
} from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, FITMEAL_TENANTS_PARENT_PAGE_ID } from '@/lib/tenant';
import { withMasterOnly } from '@/lib/withTenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { createStore, FITMEAL_STORES_DB_ID } from '@/lib/stores';
import { hashPassword } from '@/lib/adminAuth';
import { generatePassword } from '@/lib/passwordGen';
import { sendEmail, loginInfoEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function genTenantId(name: string): string {
  // 英字小文字＋6桁ランダム
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 8) || 'gym';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug}_${rand}`;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const GET = withMasterOnly(async () => {
  try {
    const tenants = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    return NextResponse.json({ tenants });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withMasterOnly(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const plan = String(body.plan || '').trim();
    const ownerEmail = String(body.ownerEmail || '').trim();
    const note = String(body.note || '').trim();

    if (!name) return NextResponse.json({ error: 'ジム名必須' }, { status: 400 });
    if (!plan) return NextResponse.json({ error: 'プラン必須' }, { status: 400 });
    if (!ownerEmail || !/^[^@]+@[^@]+$/.test(ownerEmail)) {
      return NextResponse.json({ error: 'オーナーメール形式不正' }, { status: 400 });
    }

    const tenantId = genTenantId(name);

    // 1. 顧客DB・食事DB・体重DBを並列作成
    const [customerDbId, foodDbId, weightDbId] = await Promise.all([
      createTenantCustomerDb(name, FITMEAL_TENANTS_PARENT_PAGE_ID),
      createTenantFoodDb(name, FITMEAL_TENANTS_PARENT_PAGE_ID),
      createTenantWeightDb(name, FITMEAL_TENANTS_PARENT_PAGE_ID),
    ]);

    // 2. テナントDBに登録
    const tenantPageId = await insertTenantRow(FITMEAL_TENANTS_DB_ID, {
      name,
      tenantId,
      plan,
      customerDbId,
      foodDbId,
      weightDbId,
      ownerEmail,
      startDate: jstToday(),
      note,
    });

    // 4. デフォルト店舗を自動作成（1店舗運用ならこれで十分、複数店舗は後から追加）
    let defaultStoreId: string | null = null;
    try {
      const store = await createStore({
        name,
        storeId: 'main',
        tenantId,
        manager: ownerEmail.split('@')[0],
        signature: `${name} 担当`,
      });
      defaultStoreId = store.pageId;
    } catch {
      // 店舗作成失敗してもテナント作成は成功扱い（後から手動作成可能）
    }

    // 5. 初期パスワード自動発行＋オーナーへメール送信
    const initialPassword = generatePassword(12);
    let mail: { sent: boolean; reason?: string; error?: string } = { sent: false };
    try {
      const hash = hashPassword(initialPassword);
      await setTenantPasswordHash(tenantPageId, hash);

      const result = await sendEmail(
        loginInfoEmail({ tenantName: name, ownerEmail, password: initialPassword })
      );
      if (result.sent) {
        mail = { sent: true };
      } else if (result.reason === 'no_provider') {
        mail = { sent: false, reason: 'no_provider' };
      } else {
        mail = { sent: false, reason: 'error', error: result.error };
      }
    } catch (e) {
      mail = { sent: false, reason: 'error', error: e instanceof Error ? e.message : 'unknown' };
    }

    // 新規テナント追加されたのでキャッシュ無効化
    invalidateTenantCache();

    return NextResponse.json({
      ok: true,
      tenantId,
      tenantPageId,
      customerDbId,
      foodDbId,
      defaultStoreId,
      mail,
      // パスワードは mail.sent === false の場合のみ平文で返す（マスタが手動で伝える）
      initialPassword: mail.sent ? undefined : initialPassword,
      customerDbUrl: `https://www.notion.so/${customerDbId.replace(/-/g, '')}`,
      foodDbUrl: `https://www.notion.so/${foodDbId.replace(/-/g, '')}`,
      weightDbUrl: `https://www.notion.so/${weightDbId.replace(/-/g, '')}`,
      storesDbUrl: `https://www.notion.so/${FITMEAL_STORES_DB_ID.replace(/-/g, '')}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
