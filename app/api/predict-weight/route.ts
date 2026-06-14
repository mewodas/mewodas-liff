import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDateRange,
  getRangeExtras,
} from '@/lib/notion';
import { predictWeight } from '@/lib/gemini';
import { listWeightLogsByLineUser } from '@/lib/repository/weightLogs';
import { listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';
import { withLiffTenant } from '@/lib/withTenant';

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

export const GET = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const today = jstNow();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29); // 直近30日

    const startStr = formatDate(startDate);
    const endStr = formatDate(today);

    const customer = await getCustomerByLineId(verifiedLineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    // 食事DB + 個人シートの体重/運動データを並列取得
    const dateLabels: string[] = [];
    const labelToIso: Record<string, string> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const label = `${d.getMonth() + 1}月${d.getDate()}日`;
      dateLabels.push(label);
      labelToIso[label] = formatDate(d);
    }

    const [foodRecords, extras, weightLogs, exerciseLogs] = await Promise.all([
      getFoodRecordsByDateRange(verifiedLineUserId, startStr, endStr),
      customer.foodSheetPageId
        ? getRangeExtras(customer.foodSheetPageId, dateLabels)
        : Promise.resolve({}),
      listWeightLogsByLineUser(verifiedLineUserId, startStr, endStr),
      listExerciseLogsByLineUser(verifiedLineUserId, startStr, endStr),
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

    // 体重推移は体重ログDB（書き込みと同じ「真実のソース」）から構築する。
    // 旧実装は個人シート（getRangeExtras）を見ていたため、個人シートを持たない
    // 顧客（LIFFから直接体重を記録する顧客）の推移が常に空になっていた。
    const weightHistory: Array<{ date: string; weight: number }> = weightLogs
      .filter((w) => w.date && w.weightKg > 0)
      .map((w) => ({ date: w.date, weight: w.weightKg }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // 運動日数は「運動ログDB ∪ 個人シート」で判定（admin分析と同じ DB優先・日付dedup）。
    // 旧実装は個人シート（extras）だけを見ていたため、個人シートを持たない顧客の
    // 詳細運動ログ（/api/exercise-log → 運動DB）が運動日数に反映されていなかった。
    const exercisedDates = new Set<string>();
    for (const e of exerciseLogs) {
      if (e.date) exercisedDates.add(e.date);
    }
    const extrasMap = extras as Record<
      string,
      { weight: string; exercised: boolean; exerciseContent: string }
    >;
    for (const label of dateLabels) {
      if (extrasMap[label]?.exercised) {
        const iso = labelToIso[label];
        if (iso) exercisedDates.add(iso);
      }
    }
    const exerciseDays = exercisedDates.size;

    // 体重記録が7日未満の場合は予測しない（データ不足）
    if (weightHistory.length < 7) {
      return NextResponse.json({
        prediction: null,
        reason: 'データ不足',
        message: `体重記録が${weightHistory.length}日分しかありません。7日以上の記録があると予測できます。`,
        weightHistory,
        dataPoints: {
          recordedDays: recordCount,
          weightDays: weightHistory.length,
          exerciseDays,
        },
        customer: {
          currentWeight: customer.currentWeight,
          targetWeight: customer.targetWeight,
          targetDate: customer.targetDate,
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
      weightHistory,
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
});
