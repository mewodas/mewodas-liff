'use client';

import { Trophy } from 'lucide-react';
import { useDraggableSheet } from '@/lib/useDraggableSheet';
import { StreakCard } from './StreakCard';
import type { TodayData } from './types';

export function BadgeModal({
  stats,
  onClose,
}: {
  stats: NonNullable<TodayData['stats']>;
  onClose: () => void;
}) {
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-end"
      onClick={onClose}
    >
      <div
        className={`bg-stone-100 shadow-2xl w-full overflow-y-auto ${
          expanded ? 'h-full rounded-none' : 'rounded-t-2xl max-h-[85vh]'
        }`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...handleProps}
          className="sticky top-0 bg-stone-100 pt-3 pb-2 z-10 border-b border-stone-200 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
              バッジ獲得・達成記録
            </h2>
            <button
              onClick={onClose}
              className="text-stone-500 text-2xl leading-none px-2 active:text-stone-700"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
        <div className="px-4 pb-8 pt-4">
          <StreakCard stats={stats} />
        </div>
      </div>
    </div>
  );
}
