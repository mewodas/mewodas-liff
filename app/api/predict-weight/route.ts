import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
  getRangeExtras,
  isoToJpMd,
} from '@/lib/notion';
import { predictWeight } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }

    const today = jstNow();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29); // 直近30日

    const startStr = formatDate(startDate);
    const endStr = formatDate(today);

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    // 食事DB + 個人シートの体重/運動データを並列取得
    const dateLabels: string[] = [];
    const dateIsoMap: Record<string, string> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const label = `${d.getMonth() + 1}月${d.getDate()}日`;
      dateLabels.push(label);
      dateIsoMap[label] = formatDate(d);
    }

    const [foodRecords, extras] = await Promise.all([
      getFoodRecordsByDateRange(lineUserId, startStr, endStr),
      customer.foodSheetPageId
        ? getRangeExtras(customer.foodSheetPageId, dateLabels)
        : Promise.resolve({}),
    ]);

    // 日別の集計（食事は記録あった日のみ）
    const recordedDays = new Set(foodRecords.map((r) => r.date));
    const totals = foodRecords.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );
    const recordCount = recordedDays.size;
    const avgKcal = recordCount > 0 ? Math.round(totals.kcal / recordCount) : 0;
    const avgP = recordCount > 0 ? Math.round((totals.P / recordCount) * 10) / 10 : 0;
    const avgF = recordCount > 0 ? Math.round((totals.F / recordCount) * 10) / 10 : 0;
    const avgC = recordCount > 0 ? Math.round((totals.C / recordCount) * 10) / 10 : 0;

    // 体重推移と運動日数
    const weightHistory: Array<{ date: string; weight: number }> = [];
    let exerciseDays = 0;
    const extrasMap = extras as Record<
      string,
      { weight: string; exercised: boolean; exerciseContent: string }
    >;
    for (const label of dateLabels) {
      const ex = extrasMap[label];
      if (!ex) continue;
      if (ex.weight) {
        const w = parseFloat(ex.weight);
        if (!isNaN(w) && w > 0) {
          weightHistory.push({ date: dateIsoMap[label], weight: w });
        }
      }
      if (ex.exercised) exerciseDays++;
    }

    // 体重記録が7日未満の場合は予測しない（データ不足）
    if (weightHistory.length < 7) {
      return NextResponse.json({
        prediction: null,
        reason: 'データ不足',
        message: `体重記録が${weightHistory.length}日分しかありません。7日以上の記録があると予測できます。`,
        dataPoints: {
          recordedDays: recordCount,
          weightDays: weightHistory.length,
          exerciseDays,
        },
      });
    }

    const prediction = await predictWeight({
      weightHistory,
      avgKcal,
      goalKcal: customer.goals.kcal,
      avgP,
      avgF,
      avgC,
      exerciseDays,
      currentWeight: customer.currentWeight,
      targetWeight: customer.targetWeight,
      targetDate: customer.targetDate,
    });

    return NextResponse.json({
      prediction,
      dataPoints: {
        recordedDays: recordCount,
        weightDays: weightHistory.length,
        exerciseDays,
        avgKcal,
        avgP,
        avgF,
        avgC,
      },
      customer: {
        currentWeight: customer.currentWeight,
        targetWeight: customer.targetWeight,
        targetDate: customer.targetDate,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
