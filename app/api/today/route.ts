import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDate,
  getFoodRecordsByDateRange,
  getTargetDate,
  type FoodRecord,
} from '@/lib/notion';
import { getLatestWeight } from '@/lib/repository/weightLogs';
import { computeStreakStats } from '@/lib/streakStats';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const dateParam = req.nextUrl.searchParams.get('date');
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }

    const today = dateParam || getTargetDate('今日');
    const todayActual = getTargetDate('今日');
    // ?stats=0 で 30日集計（連続記録バッジ）を省く軽量版。ホームはファーストビューを
    // ブロックしないようこれを使い、バッジは別途 /api/stats から取得する。
    // 他ページ（badges/prediction/exercise/meal-detail）は従来どおりフル版（stats 同梱）。
    const includeStats = req.nextUrl.searchParams.get('stats') !== '0';
    const startStr = (() => {
      const d = new Date(todayActual);
      d.setDate(d.getDate() - 29);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const last30TimeoutMs = 12_000;
    const [customer, records, last30Records, latestWeightLog] = await Promise.all([
      getCustomerByLineId(verifiedLineUserId),
      getFoodRecordsByDate(verifiedLineUserId, today),
      includeStats
        ? Promise.race([
            getFoodRecordsByDateRange(verifiedLineUserId, startStr, todayActual).catch(() => [] as FoodRecord[]),
            new Promise<FoodRecord[]>((resolve) => setTimeout(() => resolve([]), last30TimeoutMs)),
          ])
        : Promise.resolve([] as FoodRecord[]),
      getLatestWeight(verifiedLineUserId).catch(() => null),
    ]);

    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }
    if (customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 403 }
      );
    }

    const mealTypes: Array<'朝食' | '昼食' | '夕食' | '間食'> = ['朝食', '昼食', '夕食', '間食'];
    const mealsByType: Record<string, FoodRecord[]> = {};
    for (const t of mealTypes) {
      mealsByType[t] = records.filter((r) => r.mealType === t);
    }

    const totals = records.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    const stats = includeStats ? computeStreakStats(last30Records, todayActual) : null;

    const currentWeight = latestWeightLog?.weightKg ?? customer.currentWeight;

    const response = NextResponse.json({
      customer: {
        name: customer.name,
        goals: customer.goals,
        currentWeight,
        targetWeight: customer.targetWeight,
        targetDate: customer.targetDate,
      },
      today: {
        date: today,
        totals,
        mealsByType,
        recordCount: records.length,
        weight: '',
        exercised: '',
        exerciseContent: '',
      },
      stats,
    });
    response.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
