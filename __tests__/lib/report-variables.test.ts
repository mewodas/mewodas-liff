// レポート変数生成の回帰テスト。
// 1) 朝食/昼食/夕食/間食は「1日あたり平均」（記録日数で割る）であること
// 2) 体重は「最終日の体重」(lastWeight) を優先し、無ければ開始体重にフォールバックすること

import { describe, it, expect } from 'vitest';
import { buildReportVariables } from '@/lib/reports/variables';
import type { FoodRecord, Customer } from '@/lib/notion';

function rec(date: string, mealType: string, kcal: number, P = 0, F = 0, C = 0): FoodRecord {
  return {
    pageId: `${date}-${mealType}-${kcal}`,
    mealType,
    date,
    recordedAt: `${date}T09:00:00`,
    kcal,
    P,
    F,
    C,
    memo: '',
    imageUrl: null,
    title: `${mealType}`,
    details: null,
  };
}

const customer = {
  pageId: 'c1',
  name: '高橋歩美',
  lineUserId: 'U1',
  foodStatus: '進行中',
  goals: { kcal: 1500, P: 90, F: 50, C: 180 },
  currentWeight: 70, // 開始体重(kg)
  targetWeight: 50,
  targetDate: null,
  foodSheetPageId: 'sheet1',
  gender: null,
  heightCm: null,
  age: null,
  birthDate: null,
  email: null,
  phone: null,
  activityLevel: null,
  plan: null,
  storeId: null,
  onboardingCompletedAt: null,
  tourResetAt: null,
  registrationCompletedAt: null,
  createdTime: null,
} as unknown as Customer;

describe('buildReportVariables — 食事は1日平均', () => {
  it('範囲レポートでは朝昼夕を記録日数で割った平均を返す', () => {
    // 2日分。朝食は合計 800 → 平均 400、昼食は合計 1000 → 平均 500
    const records: FoodRecord[] = [
      rec('2026-05-01', '朝食', 300),
      rec('2026-05-01', '昼食', 600),
      rec('2026-05-02', '朝食', 500),
      rec('2026-05-02', '昼食', 400),
    ];
    const v = buildReportVariables(records, customer, null, {
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      isSingleDay: false,
    });
    expect(v.breakfast_kcal).toBe('400'); // (300+500)/2
    expect(v.lunch_kcal).toBe('500'); // (600+400)/2
    // 朝+昼+夕+間 の平均合計 == 全体の1日平均 {kcal}
    expect(v.kcal).toBe('900');
    expect(v.days).toBe('2');
    // 真の月間合計は total_* で取得できる
    expect(v.total_kcal).toBe('1800');
  });

  it('単日レポートでは当日合計と一致する（従来挙動の維持）', () => {
    const records: FoodRecord[] = [rec('2026-05-01', '朝食', 300), rec('2026-05-01', '昼食', 600)];
    const v = buildReportVariables(records, customer, null, {
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      isSingleDay: true,
    });
    expect(v.breakfast_kcal).toBe('300');
    expect(v.lunch_kcal).toBe('600');
  });
});

describe('buildReportVariables — 体重は最終日の体重', () => {
  const records: FoodRecord[] = [rec('2026-05-01', '朝食', 300)];

  it('lastWeight が渡されればそれを表示（開始体重ではなく）', () => {
    const v = buildReportVariables(
      records,
      customer,
      null,
      { startDate: '2026-05-01', endDate: '2026-05-31', isSingleDay: false },
      62.5
    );
    expect(v.weight).toBe('62.5');
  });

  it('lastWeight が無ければ開始体重にフォールバック', () => {
    const v = buildReportVariables(
      records,
      customer,
      null,
      { startDate: '2026-05-01', endDate: '2026-05-31', isSingleDay: false },
      null
    );
    expect(v.weight).toBe('70');
  });
});

describe('buildReportVariables — 週次フォーマット（週平均・前週平均・残り）', () => {
  const records: FoodRecord[] = [rec('2026-06-01', '朝食', 300)];
  const cust = {
    ...customer,
    currentWeight: 68.1,
    targetWeight: 50,
    targetDate: '2026-12-05',
  } as unknown as Customer;

  it('weightAvg / prevWeightAvg / weekAvgDelta / weightRemaining を週平均基準で返す', () => {
    const v = buildReportVariables(
      records,
      cust,
      null,
      { startDate: '2026-06-01', endDate: '2026-06-07', isSingleDay: false },
      68.0, // lastWeight
      68.3, // firstWeight
      68.1, // weightAvg（週内平均）
      68.4 // prevWeightAvg（前週平均）
    );
    expect(v.weightAvg).toBe('68.1');
    expect(v.prevWeightAvg).toBe('68.4');
    expect(v.weekAvgDelta).toBe('-0.3'); // 68.1 - 68.4
    expect(v.weightRemaining).toBe('18.1'); // |68.1 - 50|
    expect(v.targetWeight).toBe('50');
  });

  it('weightAvg 未指定なら最終体重にフォールバックし、前週平均は "-"', () => {
    const v = buildReportVariables(
      records,
      cust,
      null,
      { startDate: '2026-06-01', endDate: '2026-06-07', isSingleDay: false },
      67.5 // lastWeight のみ
    );
    expect(v.weightAvg).toBe('67.5');
    expect(v.prevWeightAvg).toBe('-');
    expect(v.weekAvgDelta).toBe('-');
  });
});
