// Customer リポジトリ抽象化レイヤ
//
// Phase 1: Notion を内部実装として利用
// Phase 2: Postgres 実装に差し替え（シグネチャは変えない）

import {
  listAllCustomers as notionListAllCustomers,
  getCustomerByPageId as notionGetCustomerByPageId,
  updateCustomer as notionUpdateCustomer,
  createCustomer as notionCreateCustomer,
  archiveCustomer as notionArchiveCustomer,
  assertCustomerOwnership,
  type Customer,
} from '@/lib/notion';
import { getCached, setCached, invalidate } from '@/lib/cache';
import { getCurrentTenant } from '@/lib/tenant';

export type { Customer };

export type CustomerPatch = {
  name?: string;
  goals?: { kcal?: number; P?: number; F?: number; C?: number };
  targetWeight?: number | null;
  targetDate?: string | null;
  foodStatus?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  age?: number | null;
  activityLevel?: string | null;
  plan?: string | null;
  currentWeight?: number | null;
  storeId?: string | null;
  lineUserId?: string | null;
  onboardingCompletedAt?: string | null;
  tourResetAt?: string | null;
  registrationCompletedAt?: string | null;
};

export async function listCustomers(opts?: { noCache?: boolean }): Promise<Customer[]> {
  const tenantId = getCurrentTenant().id;
  const key = `${tenantId}:customers:list`;
  if (!opts?.noCache) {
    const hit = getCached<Customer[]>(key);
    if (hit) return hit;
  }
  const result = await notionListAllCustomers();
  setCached(key, result, 60_000);
  return result;
}

export async function getCustomer(pageId: string): Promise<Customer | null> {
  return notionGetCustomerByPageId(pageId);
}

export async function patchCustomer(pageId: string, patch: CustomerPatch): Promise<void> {
  // クロステナント改竄防止: pageId が現テナントの顧客DBに属することを保証（不一致は forbidden: で throw）
  await assertCustomerOwnership(pageId);
  const tenantId = getCurrentTenant().id;
  invalidate(`${tenantId}:customers:`);
  return notionUpdateCustomer(pageId, patch);
}

export type CustomerCreateInput = {
  name: string;
  lineUserId?: string;
  foodStatus?: string;
  gender?: string;
  heightCm?: number;
  age?: number;
  birthdate?: string;
  activityLevel?: string;
  plan?: string;
  currentWeight?: number;
  targetWeight?: number;
  targetDate?: string;
  goals?: { kcal?: number; P?: number; F?: number; C?: number };
  storeId?: string;
  registrationCompletedAt?: string;
};

export async function createCustomer(input: CustomerCreateInput): Promise<Customer> {
  const tenantId = getCurrentTenant().id;
  invalidate(`${tenantId}:customers:`);
  return notionCreateCustomer(input);
}

export async function archiveCustomer(pageId: string): Promise<void> {
  // クロステナント削除防止: pageId が現テナントの顧客DBに属することを保証
  await assertCustomerOwnership(pageId);
  const tenantId = getCurrentTenant().id;
  invalidate(`${tenantId}:customers:`);
  return notionArchiveCustomer(pageId);
}
