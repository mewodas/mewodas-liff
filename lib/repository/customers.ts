// Customer リポジトリ抽象化レイヤ
//
// Phase 1: Notion を内部実装として利用
// Phase 2: Postgres 実装に差し替え（シグネチャは変えない）

import {
  listAllCustomers as notionListAllCustomers,
  getCustomerByPageId as notionGetCustomerByPageId,
  updateCustomer as notionUpdateCustomer,
  type Customer,
} from '@/lib/notion';

export type { Customer };

export type CustomerPatch = {
  goals?: { kcal?: number; P?: number; F?: number; C?: number };
  targetWeight?: number | null;
  targetDate?: string | null;
  foodStatus?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  age?: number | null;
  activityLevel?: string | null;
  plan?: string | null;
};

export async function listCustomers(): Promise<Customer[]> {
  return notionListAllCustomers();
}

export async function getCustomer(pageId: string): Promise<Customer | null> {
  return notionGetCustomerByPageId(pageId);
}

export async function patchCustomer(pageId: string, patch: CustomerPatch): Promise<void> {
  return notionUpdateCustomer(pageId, patch);
}
