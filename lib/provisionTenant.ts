// テナント自動プロビジョニング共有関数。
//
// 用途:
//   1) /api/admin/tenants POST: マスタが手動でテナント作成 (billingMode: '手動' / '無制限')
//   2) /api/stripe/webhook checkout.session.completed: セルフサーブ申込から自動発行 (billingMode: 'Stripe連動')
//
// 冪等性:
//   - stripeCustomerId が既存テナントに紐づいていれば再実行をスキップし、既存テナントを返す。
//   - Stripe webhook の二重発火 / リトライに耐えるための保険。

import {
  listTenantRows,
  createTenantCustomerDb,
  createTenantFoodDb,
  createTenantWeightDb,
  insertTenantRow,
  updateTenantRow,
  setTenantPasswordHash,
} from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, FITMEAL_TENANTS_PARENT_PAGE_ID } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';
import { createStore } from '@/lib/stores';
import { hashPassword } from '@/lib/adminAuth';
import { generatePassword } from '@/lib/passwordGen';
import { sendEmail, loginInfoEmail, welcomeEmail } from '@/lib/email';

export type ProvisionInput = {
  name: string;
  ownerEmail: string;
  plan: string; // プラン表示名 ('標準プラン' 等)
  note?: string;
  // 課金モード: 'Stripe連動' = セルフサーブ申込経由、'手動' = admin 手動作成 (既定)
  billingMode?: '無制限' | '手動' | 'Stripe連動';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndDate?: string | null;
  // ウェルカムメールの文面切替 (true: セルフサーブ、false: 既存 admin 経由)
  selfServe?: boolean;
};

export type ProvisionResult = {
  tenantId: string;
  tenantPageId: string;
  customerDbId: string;
  foodDbId: string;
  weightDbId: string;
  defaultStoreId: string | null;
  // 平文初期PW (mail 送信失敗時にのみマスタへ返却)。mail.sent === true の時は undefined。
  initialPassword?: string;
  mail: { sent: boolean; reason?: string; error?: string };
  // 既存テナント再利用 (冪等)
  reused: boolean;
};

function genTenantId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 8) || 'gym';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug}_${rand}`;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

/**
 * テナント自動プロビジョニング。
 * - Notion 3DB（顧客・食事・体重）作成
 * - テナント行作成
 * - billingMode / Stripe IDs 更新
 * - 初期PW生成 + scrypt ハッシュ保存
 * - デフォルト店舗作成
 * - ウェルカム/ログイン情報メール送信
 *
 * 冪等性: 同じ stripeCustomerId のテナントが既にあれば再利用して即 return。
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  // 冪等性チェック: 既存 stripeCustomer に紐づくテナントがあれば再利用
  if (input.stripeCustomerId) {
    const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
    const existing = rows.find((r) => r.stripeCustomerId === input.stripeCustomerId);
    if (existing) {
      return {
        tenantId: existing.tenantId,
        tenantPageId: existing.pageId,
        customerDbId: existing.customerDbId || '',
        foodDbId: existing.foodDbId || '',
        weightDbId: existing.weightDbId || '',
        defaultStoreId: null,
        mail: { sent: false, reason: 'reused' },
        reused: true,
      };
    }
  }

  const tenantId = genTenantId(input.name);

  // Notion 3DB を並列作成
  const [customerDbId, foodDbId, weightDbId] = await Promise.all([
    createTenantCustomerDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
    createTenantFoodDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
    createTenantWeightDb(input.name, FITMEAL_TENANTS_PARENT_PAGE_ID),
  ]);

  // テナント行作成 (基本フィールドのみ)
  const tenantPageId = await insertTenantRow(FITMEAL_TENANTS_DB_ID, {
    name: input.name,
    tenantId,
    plan: input.plan,
    customerDbId,
    foodDbId,
    weightDbId,
    ownerEmail: input.ownerEmail,
    startDate: jstToday(),
    note: input.note || '',
  });

  // billingMode / Stripe IDs を後追い更新 (insertTenantRow の signature 拡張を避けるため)
  if (
    input.billingMode !== undefined ||
    input.stripeCustomerId !== undefined ||
    input.stripeSubscriptionId !== undefined
  ) {
    await updateTenantRow(tenantPageId, {
      billingMode: input.billingMode,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
    });
  }

  // デフォルト店舗
  let defaultStoreId: string | null = null;
  try {
    const store = await createStore({
      name: input.name,
      storeId: 'main',
      tenantId,
      manager: input.ownerEmail.split('@')[0],
      signature: `${input.name} 担当`,
    });
    defaultStoreId = store.pageId;
  } catch {
    // 店舗作成失敗してもテナント作成は成功扱い
  }

  // 初期PW + メール送信
  const initialPassword = generatePassword(12);
  let mail: ProvisionResult['mail'] = { sent: false };
  try {
    const hash = hashPassword(initialPassword);
    await setTenantPasswordHash(tenantPageId, hash);

    // セルフサーブはウェルカムメール、admin 経由はログイン情報メール
    const payload = input.selfServe
      ? welcomeEmail({
          tenantName: input.name,
          ownerEmail: input.ownerEmail,
          password: initialPassword,
          trialEndDate: input.trialEndDate || undefined,
        })
      : loginInfoEmail({
          tenantName: input.name,
          ownerEmail: input.ownerEmail,
          password: initialPassword,
        });

    const result = await sendEmail(payload);
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

  invalidateTenantCache();

  return {
    tenantId,
    tenantPageId,
    customerDbId,
    foodDbId,
    weightDbId,
    defaultStoreId,
    initialPassword: mail.sent ? undefined : initialPassword,
    mail,
    reused: false,
  };
}
