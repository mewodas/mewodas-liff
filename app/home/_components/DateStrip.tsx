'use client';

import { useEffect, useRef, useState } from 'react';

function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function DateStrip({
  selectedDate,
  todayStr,
  onSelect,
}: {
  selectedDate: string;
  todayStr: string;
  onSelect: (d: string) => void;
}) {
  const dates: string[] = [];
  for (let i = 14; i >= 1; i--) dates.push(addDays(todayStr, -i));
  dates.push(todayStr);
  for (let i = 1; i <= 7; i++) dates.push(addDays(todayStr, i));

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const isFirstScrollRef = useRef(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const container = scrollRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 4);
    setCanScrollRight(
      container.scrollLeft + container.clientWidth < container.scrollWidth - 4
    );
  }

  function scrollByAmount(delta: number) {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const container = scrollRef.current;
      const btn = selectedRef.current;
      if (!container || !btn) return;
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const offsetInScroll = btnRect.left - containerRect.left + container.scrollLeft;
      const targetLeft = offsetInScroll - container.clientWidth / 2 + btn.clientWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: isFirstScrollRef.current ? 'auto' : 'smooth',
      });
      isFirstScrollRef.current = false;
      updateArrows();
    });
    return () => cancelAnimationFrame(id);
  }, [selectedDate]);

  return (
    <div className="mb-1 -mx-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => scrollByAmount(-200)}
        disabled={!canScrollLeft}
        className="w-7 h-7 rounded-full bg-white border border-stone-300 shadow-sm flex items-center justify-center text-stone-700 text-xs font-bold active:bg-stone-100 disabled:opacity-30 flex-shrink-0"
        aria-label="前の日付へ"
      >
        ◀
      </button>
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="flex-1 overflow-x-auto scrollbar-hide"
      >
        <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
          {dates.map((d) => {
            const [y, m, day] = d.split('-').map(Number);
            const date = new Date(y, m - 1, day);
            const weekday = weekdayNames[date.getDay()];
            const isSelected = d === selectedDate;
            const isToday = d === todayStr;
            const weekdayColor =
              date.getDay() === 0
                ? 'text-rose-600'
                : date.getDay() === 6
                ? 'text-sky-600'
                : 'text-stone-600';
            return (
              <button
                key={d}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onSelect(d)}
                className={`flex flex-col items-center justify-center min-w-[48px] py-2 rounded-2xl transition-all ${
                  isSelected
                    ? 'bg-emerald-500 shadow-md'
                    : isToday
                    ? 'bg-white border-2 border-emerald-300'
                    : 'bg-white border border-stone-200'
                }`}
              >
                <span
                  className={`text-[10px] font-bold ${
                    isSelected ? 'text-white' : weekdayColor
                  }`}
                >
                  {weekday}
                </span>
                <span
                  className={`text-lg font-bold leading-tight ${
                    isSelected ? 'text-white' : 'text-stone-900'
                  }`}
                >
                  {day}
                </span>
                {isToday && !isSelected && (
                  <span className="text-[8px] font-bold text-emerald-700 leading-none">今日</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => scrollByAmount(200)}
        disabled={!canScrollRight}
        className="w-7 h-7 rounded-full bg-white border border-stone-300 shadow-sm flex items-center justify-center text-stone-700 text-xs font-bold active:bg-stone-100 disabled:opacity-30 flex-shrink-0"
        aria-label="次の日付へ"
      >
        ▶
      </button>
    </div>
  );
}
