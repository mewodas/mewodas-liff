'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function fmtMd(s: string): string {
  const [, m, d] = s.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}
function weekdayOf(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
function addDaysStr(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function DateRangePicker({
  from,
  to,
  today,
  onChangeFrom,
  onChangeTo,
  onShift,
  isSingleDay,
}: {
  from: string;
  to: string;
  today: string;
  onChangeFrom: (s: string) => void;
  onChangeTo: (s: string) => void;
  onShift: (delta: number) => void;
  isSingleDay: boolean;
}) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0"
          aria-label="前へ"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
        </button>
        <div className="flex-1 flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-2 py-1">
          <button
            type="button"
            onClick={() => fromRef.current?.showPicker?.()}
            className="flex-1 text-sm font-bold text-stone-900 text-center hover:text-emerald-700"
          >
            {fmtMd(from)}
            <span className="text-[10px] text-stone-500 ml-1">({WEEKDAYS[weekdayOf(from)]})</span>
            <input
              ref={fromRef}
              type="date"
              value={from}
              max={to}
              onChange={(e) => e.target.value && onChangeFrom(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </button>
          <span className="text-xs text-stone-400">〜</span>
          <button
            type="button"
            onClick={() => toRef.current?.showPicker?.()}
            className="flex-1 text-sm font-bold text-stone-900 text-center hover:text-emerald-700"
          >
            {fmtMd(to)}
            <span className="text-[10px] text-stone-500 ml-1">({WEEKDAYS[weekdayOf(to)]})</span>
            <input
              ref={toRef}
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => e.target.value && onChangeTo(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </button>
          <CalendarIcon className="w-4 h-4 text-stone-400 flex-shrink-0 ml-0.5" strokeWidth={2.2} />
        </div>
        <button
          type="button"
          onClick={() => onShift(1)}
          disabled={to >= today}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0 disabled:opacity-30"
          aria-label="次へ"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
        </button>
      </div>
      <div className="flex gap-1 flex-wrap">
        <Quick label="今日" onClick={() => { onChangeFrom(today); onChangeTo(today); }} />
        <Quick label="昨日" onClick={() => { const y = addDaysStr(today, -1); onChangeFrom(y); onChangeTo(y); }} />
        <Quick label="直近7日" onClick={() => { onChangeFrom(addDaysStr(today, -6)); onChangeTo(today); }} />
        <Quick label="直近30日" onClick={() => { onChangeFrom(addDaysStr(today, -29)); onChangeTo(today); }} />
        <span className="text-[10px] text-stone-400 self-center ml-auto">
          {isSingleDay ? '1日' : `${diffDays(from, to)}日間`}
        </span>
      </div>
    </div>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50"
    >
      {label}
    </button>
  );
}

function diffDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}
