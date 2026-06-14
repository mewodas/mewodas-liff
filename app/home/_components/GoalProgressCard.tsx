import { Target } from 'lucide-react';
import { PredictionBlock } from './PredictionBlock';
import type { TodayData, PredictionData } from './types';

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function calcGoalProgress(customer: TodayData['customer']) {
  const currentW = customer.currentWeight;
  const targetW = customer.targetWeight;
  if (!currentW || !targetW) return null;
  const remainingKg = Math.max(0, r1(currentW - targetW));
  let remainingWeeks: number | null = null;
  let requiredPace: number | null = null;
  if (customer.targetDate) {
    // JST の今日0:00 と、ローカル解釈した目標日0:00 で日数差を取る（/goals ページと同方式）。
    // 旧実装は new Date()（UTC時刻入り）と new Date("YYYY-MM-DD")（UTC0:00）を引いていて
    // 締切付近で1日ずれ・残り週数/必要ペースが /goals と食い違っていた。
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    today.setHours(0, 0, 0, 0);
    const [ty, tm, td2] = customer.targetDate.split('-').map(Number);
    const td = new Date(ty, tm - 1, td2);
    const daysLeft = Math.ceil((td.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0) {
      remainingWeeks = Math.max(1, Math.ceil(daysLeft / 7));
      requiredPace = r1(remainingKg / remainingWeeks);
    }
  }
  return { currentW, targetW, remainingKg, remainingWeeks, requiredPace };
}

export function GoalProgressCard({
  customer,
  isToday,
  prediction,
  predictionLoading,
}: {
  customer: TodayData['customer'];
  isToday: boolean;
  prediction: PredictionData | null;
  predictionLoading: boolean;
}) {
  const goalProgress = calcGoalProgress(customer);
  if (!goalProgress) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
        体重目標進捗
      </h2>
      <div className="space-y-1 text-sm text-stone-800">
        <div className="flex justify-between">
          <span className="text-stone-600">現在</span>
          <span className="font-bold">{goalProgress.currentW} kg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-600">目標</span>
          <span className="font-bold">{goalProgress.targetW} kg</span>
        </div>
        {(() => {
          const sign = goalProgress.targetW < goalProgress.currentW ? '-' : goalProgress.targetW > goalProgress.currentW ? '+' : '';
          return (
            <>
              <div className="flex justify-between">
                <span className="text-stone-600">残り</span>
                <span className="font-bold text-emerald-700">{sign}{goalProgress.remainingKg} kg</span>
              </div>
              {goalProgress.remainingWeeks !== null && (
                <>
                  <div className="flex justify-between">
                    <span className="text-stone-600">期限</span>
                    <span className="font-bold">あと {goalProgress.remainingWeeks} 週</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-stone-100">
                    <span className="text-stone-600">必要ペース</span>
                    <span className="font-bold text-emerald-700">{sign}{goalProgress.requiredPace} kg/週</span>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>

      {isToday && (
        <PredictionBlock
          prediction={prediction}
          loading={predictionLoading}
          targetWeight={customer.targetWeight}
        />
      )}
    </div>
  );
}
