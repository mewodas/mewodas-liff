'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function fmtMd(s: string): string {
  const [, m, d] = s.split('-');
  return `${parseInt(m, 10).toString().padStart(2, '0')}/${parseInt(d, 10).toString().padStart(2, '0')}`;
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

  const isToday = isSingleDay && from === today;
  const isYesterday = isSingleDay && from === addDaysStr(today, -1);
  const isLast7 = !isSingleDay && from === addDaysStr(today, -6) && to === today;
  const isLast30 = !isSingleDay && from === addDaysStr(today, -29) && to === today;

  return (
    <div className="space-y-2.5">
      {/* 単日 or 範囲の見出し（横矢印で前後に移動） */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0"
          aria-label="前へ"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.4} />
        </button>

        <button
          type="button"
          onClick={() => fromRef.current?.showPicker?.()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 rounded-xl hover:bg-stone-50 active:bg-stone-100"
        >
          {isSingleDay ? (
            <>
              <span className="text-xl font-bold text-stone-900 tracking-tight">{fmtMd(from)}</span>
              <span className="text-sm font-bold text-stone-700">（{WEEKDAYS[weekdayOf(from)]}）</span>
            </>
          ) : (
            <span className="text-sm font-bold text-stone-900">
              {fmtMd(from)}（{WEEKDAYS[weekdayOf(from)]}）
              <span className="text-stone-400 mx-1">〜</span>
              {fmtMd(to)}（{WEEKDAYS[weekdayOf(to)]}）
            </span>
          )}
          <CalendarIcon className="w-4 h-4 text-stone-400 ml-0.5" strokeWidth={2.2} />
          <input
            ref={fromRef}
            type="date"
            value={from}
            max={isSingleDay ? today : to}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (isSingleDay) {
                onChangeFrom(v);
                onChangeTo(v);
              } else {
                onChangeFrom(v);
              }
            }}
            className="sr-only"
            tabIndex={-1}
          />
          {!isSingleDay && (
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
          )}
        </button>

        <button
          type="button"
          onClick={() => onShift(1)}
          disabled={to >= today}
          className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0 disabled:opacity-30"
          aria-label="次へ"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.4} />
        </button>
      </div>

      {/* 範囲指定クイックボタン */}
      <div className="flex gap-1 flex-wrap">
        <Quick label="今日" active={isToday} onClick={() => { onChangeFrom(today); onChangeTo(today); }} />
        <Quick label="昨日" active={isYesterday} onClick={() => { const y = addDaysStr(today, -1); onChangeFrom(y); onChangeTo(y); }} />
        <Quick label="直近7日" active={isLast7} onClick={() => { onChangeFrom(addDaysStr(today, -6)); onChangeTo(today); }} />
        <Quick label="直近30日" active={isLast30} onClick={() => { onChangeFrom(addDaysStr(today, -29)); onChangeTo(today); }} />
        {!isSingleDay && (
          <button
            type="button"
            onClick={() => toRef.current?.showPicker?.()}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1"
          >
            <CalendarIcon className="w-3 h-3" strokeWidth={2.4} />
            終了日
          </button>
        )}
      </div>
    </div>
  );
}

function Quick({ label, onClick, active = false }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
        active
          ? 'bg-emerald-500 text-white border-emerald-500'
          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}

