// 食事記録リポジトリ抽象化レイヤ
//
// Phase 1: Notion 実装
// Phase 2: Postgres 実装に差し替え

import {
  getFoodRecordsByDate,
  getFoodRecordsByDateRange,
  updateFoodRecord,
  deleteFoodRecord,
  type FoodRecord,
} from '@/lib/notion';

export type { FoodRecord };

export type RecordPatch = {
  kcal?: number;
  P?: number;
  F?: number;
  C?: number;
  memo?: string;
};

export async function listRecordsByDate(
  lineUserId: string,
  date: string
): Promise<FoodRecord[]> {
  return getFoodRecordsByDate(lineUserId, date);
}

export async function listRecordsInRange(
  lineUserId: string,
  startDate: string,
  endDate: string
): Promise<FoodRecord[]> {
  return getFoodRecordsByDateRange(lineUserId, startDate, endDate);
}

export async function patchRecord(pageId: string, patch: RecordPatch): Promise<void> {
  return updateFoodRecord(pageId, patch);
}

export async function archiveRecord(pageId: string): Promise<void> {
  return deleteFoodRecord(pageId);
}
