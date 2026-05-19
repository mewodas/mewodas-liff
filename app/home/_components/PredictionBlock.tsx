'use client';

import {
  Sparkles,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { PredictionData } from './types';

export function PredictionBlock({
  prediction,
  loading,
  targetWeight,
}: {
  prediction: PredictionData | null;
  loading: boolean;
  targetWeight: number | null;
}) {
  if (loading && !prediction) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="text-xs text-stone-500 inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" strokeWidth={2.2} />
          AI予測を生成中…
        </div>
      </div>
    );
  }
  if (!prediction) return null;

  if (!prediction.prediction) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" strokeWidth={2.2} />
          3ヶ月後のAI予測
        </div>
        <div className="text-xs text-stone-600 bg-stone-50 rounded-lg p-2">
          {prediction.message || 'データ不足のため予測できません'}
        </div>
      </div>
    );
  }

  const p = prediction.prediction;
  const confidenceColor =
    p.confidenceLevel === 'high'
      ? 'text-emerald-700'
      : p.confidenceLevel === 'low'
      ? 'text-stone-500'
      : 'text-amber-700';
  const confidenceLabel =
    p.confidenceLevel === 'high' ? '高' : p.confidenceLevel === 'low' ? '低' : '中';
  const GoalIcon =
    p.willReachGoal === true ? CheckCircle2 : p.willReachGoal === false ? AlertTriangle : null;
  const goalIconColor = p.willReachGoal === true ? 'text-emerald-600' : 'text-amber-600';
  const ChangeIcon = p.monthlyChange < 0 ? TrendingDown : p.monthlyChange > 0 ? TrendingUp : ArrowRight;

  return (
    <div className="mt-3 pt-3 border-t border-stone-100">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-bold text-stone-700 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" strokeWidth={2.2} />
          3ヶ月後のAI予測
        </div>
        <div className={`text-[10px] font-medium ${confidenceColor}`}>
          信頼度：{confidenceLabel}
        </div>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-2">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-purple-700">
            {p.predictedWeight} kg
          </span>
          {targetWeight && (
            <span className="text-xs text-stone-600 inline-flex items-center gap-0.5">
              （目標 {targetWeight} kg
              {GoalIcon && <GoalIcon className={`w-3 h-3 ${goalIconColor}`} strokeWidth={2.2} />}）
            </span>
          )}
        </div>
        <div className="text-xs text-stone-700 inline-flex items-center gap-1">
          <ChangeIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
          月平均 {Math.abs(p.monthlyChange)} kg/月
        </div>
        {p.comment && (
          <div className="text-xs font-medium text-stone-800 mt-2 inline-flex items-center gap-1">
            <MessageCircle className="w-3 h-3" strokeWidth={2.2} />
            {p.comment}
          </div>
        )}
      </div>
      {p.recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-stone-700">アドバイス</div>
          {p.recommendations.map((r, i) => (
            <div key={i} className="text-[11px] text-stone-700 bg-stone-50 rounded-lg px-2 py-1">
              ・{r}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-stone-500 mt-2">
        ※ 直近30日の食事・運動・体重データから推定。実際の体重変化と異なる場合があります。
      </div>
    </div>
  );
}
