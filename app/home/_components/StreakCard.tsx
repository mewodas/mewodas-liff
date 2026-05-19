import { Trophy, Flame, ClipboardList, BarChart3 } from 'lucide-react';
import type { TodayData } from './types';

export function StreakCard({
  stats,
}: {
  stats: NonNullable<TodayData['stats']>;
}) {
  const { streakDays, bestStreakDays, last30RecordedDays, monthlyRecordedDays } = stats;
  if (
    streakDays === 0 &&
    bestStreakDays === 0 &&
    last30RecordedDays === 0 &&
    monthlyRecordedDays === 0
  ) {
    return null;
  }
  const badges: Array<{ icon: string; label: string; threshold: number }> = [
    { icon: '🥉', label: '3日連続記録', threshold: 3 },
    { icon: '🥈', label: '7日連続記録', threshold: 7 },
    { icon: '🥇', label: '14日連続記録', threshold: 14 },
    { icon: '👑', label: '30日連続記録', threshold: 30 },
  ];
  const achievedBadges = badges.filter((b) => bestStreakDays >= b.threshold);

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <Trophy className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
        バッジ獲得・達成記録
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-600" strokeWidth={2.2} />
            連続記録日数
          </div>
          <div className="text-2xl font-bold text-orange-700 mt-0.5">
            {streakDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            今、何日連続で記録中か
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-600" strokeWidth={2.2} />
            最長連続記録
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-0.5">
            {bestStreakDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            直近30日のベスト記録
          </div>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.2} />
            今月の記録日数
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-0.5">
            {monthlyRecordedDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            今月、食事を記録した日数
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
            直近30日の記録
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-0.5">
            {last30RecordedDays}
            <span className="text-xs font-medium text-stone-600 ml-1">日</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">
            過去30日で記録した日数
          </div>
        </div>
      </div>

      {achievedBadges.length > 0 && (
        <div>
          <div className="text-xs font-bold text-stone-700 mb-1">獲得バッジ</div>
          <div className="flex flex-wrap gap-1.5">
            {achievedBadges.map((b) => (
              <span
                key={b.label}
                className="text-xs font-bold text-stone-900 bg-amber-100 border border-amber-300 px-2 py-1 rounded-full"
              >
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
