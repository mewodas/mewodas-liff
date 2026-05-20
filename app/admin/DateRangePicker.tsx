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
            max={today}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onChangeFrom(v);
              // 開始日が終了日より後になった場合のみ終了日を合わせる。
              // それ以外は終了日を据え置き、単日→範囲に広げられるようにする。
              if (v > to) onChangeTo(v);
            }}
            className="sr-only"
            tabIndex={-1}
          />
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

      {/* 範囲指定: 開始日/終了日を常時表示してタップで変更可能 */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => fromRef.current?.showPicker?.()}
          className="flex-1 min-w-[120px] text-sm font-bold px-4 py-2.5 rounded-xl bg-white border-2 border-stone-300 text-stone-800 hover:bg-stone-50 hover:border-emerald-400 inline-flex items-center justify-center gap-1.5"
        >
          <CalendarIcon className="w-4 h-4 text-emerald-600" strokeWidth={2.4} />
          開始日: {fmtMd(from)}
        </button>
        <span className="text-sm text-stone-400 font-bold">〜</span>
        <button
          type="button"
          onClick={() => toRef.current?.showPicker?.()}
          className="flex-1 min-w-[120px] text-sm font-bold px-4 py-2.5 rounded-xl bg-white border-2 border-stone-300 text-stone-800 hover:bg-stone-50 hover:border-emerald-400 inline-flex items-center justify-center gap-1.5"
        >
          <CalendarIcon className="w-4 h-4 text-emerald-600" strokeWidth={2.4} />
          終了日: {fmtMd(to)}
        </button>
        {!isSingleDay && (
          <button
            type="button"
            onClick={() => onChangeTo(from)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200"
          >
            単日に戻す
          </button>
        )}
      </div>
    </div>
  );
}

