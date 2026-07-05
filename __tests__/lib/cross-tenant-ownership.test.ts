// P0/P1 回帰テスト: クロステナント / クロス顧客 IDOR の封鎖（2026-05-31 監査 設計#2/#10）。
//
// 全テナントが単一 Notion キーを共有するため、所有権チェックを「リポジトリ/データ層」へ集約して
// 付け忘れを構造的に不能化した（設計#2）。本テストはその不変条件を固定し、将来のリファクタで
// 「他テナントの pageId を渡すと操作できる」状態へ静かに退行しないことを保証する（設計#10）。
//
// 封鎖対象:
//   - 管理者 pageId ルートの IDOR（customers/[id], records/[pageId], stores/[id]）
//   - LIFF クロス顧客 IDOR（同一テナント内で他顧客の食事記録を改竄/削除）
//
// 方針: テナント文脈(getCurrentTenant)と Notion HTTP 層(global.fetch)をモックし、
//        「親DB / tenant_id / LINE_UserID が現テナント・現ユーザーと一致しなければ拒否」を検証する。

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- テナント定義（A=自テナント, B=他テナント） ---
const TENANT_A = {
  id: 'tenant-a',
  notionCustomerDbId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  notionFoodDbId: 'ffffffffffffffffffffffffffffffff',
  notionBodyCompDbId: 'cccccccccccccccccccccccccccccccc',
  notionApiKey: 'key-a',
  defaultGoals: { kcal: 2000, P: 120, F: 60, C: 250 },
};
const OTHER_DB_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // 他テナントのDB

// vi.mock は巻き上げられるため、可変参照は vi.hoisted で確保する
const ref = vi.hoisted(() => ({ tenant: null as any }));

// getCurrentTenant だけ差し替え、他の実エクスポート(FITMEAL_PLANS_DB_ID 等)は温存する
vi.mock('@/lib/tenant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant')>();
  return { ...actual, getCurrentTenant: () => ref.tenant };
});

import {
  assertCustomerOwnership,
  assertFoodRecordOwnership,
  getCustomerByPageId,
} from '@/lib/notion';
import { patchCustomer, archiveCustomer } from '@/lib/repository/customers';
import { patchRecord, archiveRecord } from '@/lib/repository/records';
import { getStore, updateStore, deleteStore } from '@/lib/stores';
import { updateBodyCompositionLog, deleteBodyCompositionLog } from '@/lib/repository/bodyComposition';

// --- fetch モックのレスポンス組み立て ---
function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function customerPage(parentDbId: string) {
  return {
    id: 'cust-page-1',
    parent: { type: 'database_id', database_id: parentDbId },
    properties: { 氏名: { title: [{ plain_text: '顧客X' }] } },
  };
}

function foodPage(parentDbId: string, ownerLineUserId: string) {
  return {
    id: 'food-page-1',
    parent: { type: 'database_id', database_id: parentDbId },
    properties: { LINE_UserID: { rich_text: [{ plain_text: ownerLineUserId }] } },
  };
}

function storePage(tenantId: string) {
  return {
    id: 'store-page-1',
    properties: {
      店舗名: { title: [{ plain_text: '店舗X' }] },
      店舗ID: { rich_text: [{ plain_text: 's-001' }] },
      tenant_id: { rich_text: [{ plain_text: tenantId }] },
      住所: { rich_text: [] },
      電話番号: { phone_number: null },
      営業時間: { rich_text: [] },
      担当者: { rich_text: [] },
      署名: { rich_text: [] },
      有効: { checkbox: true },
    },
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  ref.tenant = { ...TENANT_A };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('assertCustomerOwnership — 顧客pageIdは現テナントの顧客DB所属のみ許可', () => {
  it('自テナントの顧客DBに属する pageId は通過する', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(customerPage(TENANT_A.notionCustomerDbId)));
    await expect(assertCustomerOwnership('cust-page-1')).resolves.toBeUndefined();
  });

  it('★ 他テナントのDBに属する pageId は forbidden で拒否される', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(customerPage(OTHER_DB_ID)));
    await expect(assertCustomerOwnership('cust-page-1')).rejects.toThrow(/forbidden/);
  });

  it('★ parent が database_id でない（DB直下でない）pageId も拒否される', async () => {
    const page = { id: 'x', parent: { type: 'page_id', page_id: 'p' }, properties: {} };
    fetchMock.mockResolvedValueOnce(okResponse(page));
    await expect(assertCustomerOwnership('x')).rejects.toThrow(/forbidden/);
  });
});

describe('getCustomerByPageId — 他テナント顧客の読取を null(=404) に潰す', () => {
  it('自テナントの顧客は取得できる', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(customerPage(TENANT_A.notionCustomerDbId)));
    const c = await getCustomerByPageId('cust-page-1');
    expect(c).not.toBeNull();
    expect(c!.pageId).toBe('cust-page-1');
  });

  it('★ 他テナントの顧客 pageId は null（読取IDOR封鎖）', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(customerPage(OTHER_DB_ID)));
    expect(await getCustomerByPageId('cust-page-1')).toBeNull();
  });
});

describe('assertFoodRecordOwnership — 食事記録のテナント所属 + LINE_UserID 所有者照合', () => {
  it('自テナントの食事DB所属なら管理経路(expectedLineUserId 省略)で通過', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(foodPage(TENANT_A.notionFoodDbId, 'U_owner')));
    await expect(assertFoodRecordOwnership('food-page-1')).resolves.toBeUndefined();
  });

  it('★ 他テナントの食事DB所属は forbidden で拒否', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(foodPage(OTHER_DB_ID, 'U_owner')));
    await expect(assertFoodRecordOwnership('food-page-1')).rejects.toThrow(/forbidden/);
  });

  it('★ 同一テナント内でも別顧客(LINE_UserID不一致)の記録はLIFF経路で拒否（クロス顧客IDOR封鎖）', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(foodPage(TENANT_A.notionFoodDbId, 'U_owner')));
    await expect(assertFoodRecordOwnership('food-page-1', 'U_attacker')).rejects.toThrow(/forbidden/);
  });

  it('LINE_UserID が一致すれば LIFF 経路でも通過', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(foodPage(TENANT_A.notionFoodDbId, 'U_owner')));
    await expect(assertFoodRecordOwnership('food-page-1', 'U_owner')).resolves.toBeUndefined();
  });
});

describe('repository/customers — 集約された所有権ガードを経由する', () => {
  it('★ patchCustomer は他テナント pageId を forbidden で拒否し、更新処理に到達しない', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(customerPage(OTHER_DB_ID)));
    await expect(patchCustomer('cust-page-1', { name: '改竄' })).rejects.toThrow(/forbidden/);
    // assert の GET 1回のみ。更新の PATCH には進んでいないこと（fetch が 2 回呼ばれない）
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('★ archiveCustomer は他テナント pageId を forbidden で拒否する', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(customerPage(OTHER_DB_ID)));
    await expect(archiveCustomer('cust-page-1')).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('repository/records — 集約された所有権ガードを経由する', () => {
  it('★ patchRecord は他テナント pageId を forbidden で拒否し、更新処理に到達しない', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(foodPage(OTHER_DB_ID, 'U_owner')));
    await expect(patchRecord('food-page-1', { P: 1, F: 1, C: 1 })).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('★ archiveRecord は他テナント pageId を forbidden で拒否する', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(foodPage(OTHER_DB_ID, 'U_owner')));
    await expect(archiveRecord('food-page-1')).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('stores — 全テナント横断DBを tenant_id で論理分離', () => {
  it('自テナントの店舗は取得できる', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(storePage(TENANT_A.id)));
    const s = await getStore('store-page-1');
    expect(s).not.toBeNull();
    expect(s!.tenantId).toBe(TENANT_A.id);
  });

  it('★ 他テナントの店舗 pageId は getStore で null（読取分離）', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(storePage('tenant-b')));
    expect(await getStore('store-page-1')).toBeNull();
  });

  it('★ updateStore は他テナントの店舗を forbidden で拒否する', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(storePage('tenant-b')));
    await expect(updateStore('store-page-1', { name: '改竄' })).rejects.toThrow(/forbidden/);
    // 所有権チェックの GET のみ。更新 PATCH には進まない
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('★ deleteStore は他テナントの店舗を forbidden で拒否する', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(storePage('tenant-b')));
    await expect(deleteStore('store-page-1')).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// 体組成ページのparent形状ヘルパー（database_id または data_source_id）
function bodyCompPage(parentType: 'database_id' | 'data_source_id', dbId: string) {
  return {
    id: 'bodycomp-page-1',
    created_time: '2026-06-01T00:00:00.000Z',
    parent: { type: parentType, [parentType]: dbId },
    properties: {
      '計測日': { title: [{ plain_text: '2026-06-01' }] },
      'LINEユーザーID': { rich_text: [{ plain_text: 'U_owner' }] },
      '顧客名': { rich_text: [{ plain_text: '顧客X' }] },
      '体重(kg)': { number: 60 },
      '体脂肪率(%)': { number: 20 },
      '筋肉量(kg)': { number: 45 },
    },
  };
}

const BODYCOMP_INPUT = {
  lineUserId: 'U_owner',
  customerName: '顧客X',
  measureDate: '2026-06-01',
  weightKg: 61,
  bodyFatPct: 20,
  muscleMassKg: 45,
};

describe('repository/bodyComposition — IDOR封鎖（database_id / data_source_id 両対応）', () => {
  it('自テナントのbodycomp DB所属ページ(database_id)はupdateを通過する', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(bodyCompPage('database_id', TENANT_A.notionBodyCompDbId)))
      .mockResolvedValueOnce(okResponse(bodyCompPage('database_id', TENANT_A.notionBodyCompDbId)));
    await expect(updateBodyCompositionLog('bodycomp-page-1', BODYCOMP_INPUT)).resolves.toBeDefined();
  });

  it('自テナントのbodycomp DB所属ページ(data_source_id)はupdateを通過する', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(bodyCompPage('data_source_id', TENANT_A.notionBodyCompDbId)))
      .mockResolvedValueOnce(okResponse(bodyCompPage('data_source_id', TENANT_A.notionBodyCompDbId)));
    await expect(updateBodyCompositionLog('bodycomp-page-1', BODYCOMP_INPUT)).resolves.toBeDefined();
  });

  it('★ 他テナントのDB所属ページ(database_id)はupdateでforbiddenを返す', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(bodyCompPage('database_id', OTHER_DB_ID)));
    await expect(updateBodyCompositionLog('bodycomp-page-1', BODYCOMP_INPUT)).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('★ 他テナントのDB所属ページ(data_source_id)はupdateでforbiddenを返す', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(bodyCompPage('data_source_id', OTHER_DB_ID)));
    await expect(updateBodyCompositionLog('bodycomp-page-1', BODYCOMP_INPUT)).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('自テナントのbodycomp DB所属ページ(data_source_id)はdeleteを通過する', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(bodyCompPage('data_source_id', TENANT_A.notionBodyCompDbId)))
      .mockResolvedValueOnce(okResponse({ archived: true }));
    await expect(deleteBodyCompositionLog('bodycomp-page-1')).resolves.toBeUndefined();
  });

  it('★ 他テナントのDB所属ページ(data_source_id)はdeleteでforbiddenを返す', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(bodyCompPage('data_source_id', OTHER_DB_ID)));
    await expect(deleteBodyCompositionLog('bodycomp-page-1')).rejects.toThrow(/forbidden/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
