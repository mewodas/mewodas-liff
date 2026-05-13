import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDate,
  getFoodRecordsByDateRange,
  getTargetDate,
  getDailyExtras,
  isoToJpMd,
  type FoodRecord,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function computeStats(records: FoodRecord[], todayStr: string, _goalKcal: number) {
  void _goalKcal;
  // 日別に集計
  const byDate = new Map<string, { kcal: number; recorded: boolean }>();
  for (const r of records) {
    const cur = byDate.get(r.date) || { kcal: 0, recorded: false };
    cur.kcal += r.kcal;
    cur.recorded = true;
    byDate.set(r.date, cur);
  }

  // 当日含む直近30日
  const today = new Date(todayStr);
  let streakDays = 0;
  let bestStreakDays = 0;
  let currentStreakInWindow = 0;
  let last30RecordedDays = 0;
  let monthlyRecordedDays = 0;
  let stoppedCurrentStreak = false;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = byDate.get(ds);
    const isCurrentMonth =
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    if (day?.recorded) {
      if (!stoppedCurrentStreak) streakDays++;
      last30RecordedDays++;
      if (isCurrentMonth) monthlyRecordedDays++;
      currentStreakInWindow++;
      if (currentStreakInWindow > bestStreakDays) bestStreakDays = currentStreakInWindow;
    } else {
      // 当日は未記録でもストリーク継続扱い（記録途中の可能性）
      if (i !== 0) {
        stoppedCurrentStreak = true;
        currentStreakInWindow = 0;
      }
    }
  }

  return {
    streakDays,
    bestStreakDays,
    last30RecordedDays,
    monthlyRecordedDays,
  };
}

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    const dateParam = req.nextUrl.searchParams.get('date'); // yyyy-MM-dd, 省略時は今日
    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }

    const today = dateParam || getTargetDate('今日');
    // 並列実行で高速化
    const [customer, records] = await Promise.all([
      getCustomerByLineId(lineUserId),
      getFoodRecordsByDate(lineUserId, today),
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

    // 食事区分ごとにグルーピング
    const mealTypes: Array<'朝食' | '昼食' | '夕食' | '間食'> = ['朝食', '昼食', '夕食', '間食'];
    const mealsByType: Record<string, FoodRecord[]> = {};
    for (const t of mealTypes) {
      mealsByType[t] = records.filter((r) => r.mealType === t);
    }

    // 合計
    const totals = records.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    // 個人シートから体重・運動データを取得 + 直近30日のストリーク計算を並列実行
    const isToday = today === getTargetDate('今日');
    const startStr = (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const [extras, last30Records] = await Promise.all([
      customer.foodSheetPageId
        ? getDailyExtras(customer.foodSheetPageId, isoToJpMd(today))
        : Promise.resolve({ weight: '', exercised: '', exerciseContent: '' }),
      isToday
        ? getFoodRecordsByDateRange(lineUserId, startStr, today)
        : Promise.resolve([] as FoodRecord[]),
    ]);

    // ストリーク計算（当日表示時のみ）
    const stats = isToday
      ? computeStats(last30Records, today, customer.goals.kcal)
      : null;

    return NextResponse.json({
      customer: {
        name: customer.name,
        goals: customer.goals,
        currentWeight: customer.currentWeight,
        targetWeight: customer.targetWeight,
        targetDate: customer.targetDate,
      },
      today: {
        date: today,
        totals,
        mealsByType,
        recordCount: records.length,
        weight: extras.weight,
        exercised: extras.exercised,
        exerciseContent: extras.exerciseContent,
      },
      stats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
