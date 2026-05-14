'use client';

import { useRef, useState } from 'react';

function useDraggableSheet(onClose: () => void) {
  const [expanded, setExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    if (!expanded && dy < 0) {
      setDragOffset(0);
    } else {
      setDragOffset(dy);
    }
  }
  function onPointerUp() {
    if (startY.current === null) return;
    const dy = dragOffset;
    if (dy > 80) {
      onClose();
    } else if (dy < -50 && !expanded) {
      setExpanded(true);
    } else if (dy > 40 && expanded) {
      setExpanded(false);
    }
    setDragOffset(0);
    startY.current = null;
  }

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
  const sheetStyle =
    dragOffset !== 0
      ? { transform: `translateY(${dragOffset}px)`, transition: 'none' as const }
      : { transform: 'translateY(0)', transition: 'transform 0.2s ease-out' };

  return { expanded, handleProps, sheetStyle };
}

export default function WeightExerciseCard({
  selectedDate,
  isToday,
  lineUserId,
  initialWeight,
  initialExercised,
  initialExerciseContent,
  onUpdated,
}: {
  selectedDate: string;
  isToday: boolean;
  lineUserId: string;
  initialWeight?: string;
  initialExercised?: string;
  initialExerciseContent?: string;
  onUpdated: () => void;
}) {
  const [weightOpen, setWeightOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);

  const hasWeight = !!initialWeight;
  const exercised = initialExercised === '✅';
  const hasExercise = !!initialExercised;

  const [, mm, dd] = selectedDate.split('-');
  const heading = isToday ? '今日の記録' : `${parseInt(mm, 10)}月${parseInt(dd, 10)}日の記録`;

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3">📝 {heading}</h2>
      <div className="grid grid-cols-2 gap-2 items-stretch">
        <button
          type="button"
          onClick={() => setWeightOpen(true)}
          className={`flex flex-col items-start text-left rounded-xl p-3 border active:bg-stone-50 min-h-[78px] ${
            hasWeight ? 'bg-sky-50 border-sky-300' : 'bg-stone-50 border-stone-200 border-dashed'
          }`}
        >
          <div className="text-xs font-bold text-stone-700 mb-1">⚖️ 体重</div>
          <div className="flex-1 flex items-center w-full">
            {hasWeight ? (
              <span className="text-base font-bold text-stone-900 leading-snug">
                {initialWeight}
                <span className="text-xs font-normal text-stone-500 ml-0.5">kg</span>
              </span>
            ) : (
              <span className="text-xs text-stone-500">タップで入力</span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setExerciseOpen(true)}
          className={`flex flex-col items-start text-left rounded-xl p-3 border active:bg-stone-50 min-h-[78px] ${
            hasExercise ? 'bg-amber-50 border-amber-300' : 'bg-stone-50 border-stone-200 border-dashed'
          }`}
        >
          <div className="text-xs font-bold text-stone-700 mb-1">🏃 運動</div>
          <div className="flex-1 flex items-center w-full min-w-0">
            {hasExercise ? (
              initialExerciseContent ? (
                <span className="text-base font-bold text-stone-900 line-clamp-2 leading-snug w-full break-words">
                  {initialExerciseContent}
                </span>
              ) : (
                <span className="text-xs text-stone-500">記録あり</span>
              )
            ) : (
              <span className="text-xs text-stone-500">タップで入力</span>
            )}
          </div>
        </button>
      </div>

      {weightOpen && (
        <WeightSheet
          selectedDate={selectedDate}
          lineUserId={lineUserId}
          initialValue={initialWeight || ''}
          onClose={() => setWeightOpen(false)}
          onSaved={() => {
            setWeightOpen(false);
            onUpdated();
          }}
        />
      )}

      {exerciseOpen && (
        <ExerciseSheet
          selectedDate={selectedDate}
          lineUserId={lineUserId}
          initialExercised={exercised}
          initialContent={initialExerciseContent || ''}
          hasInitial={hasExercise}
          onClose={() => setExerciseOpen(false)}
          onSaved={() => {
            setExerciseOpen(false);
            onUpdated();
          }}
        />
      )}
    </div>
  );
}

function WeightSheet({
  selectedDate,
  lineUserId,
  initialValue,
  onClose,
  onSaved,
}: {
  selectedDate: string;
  lineUserId: string;
  initialValue: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);

  async function save() {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 300) {
      setError('体重を 0〜300 の数値で入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/log/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, date: selectedDate, weight: w }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={saving ? undefined : onClose}>
      <div
        className={`bg-white shadow-2xl w-full flex flex-col ${
          expanded ? 'h-full rounded-none' : 'rounded-t-2xl max-h-[88vh]'
        }`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...handleProps}
          className="pt-3 pb-2 border-b border-stone-200 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">⚖️ 体重を記録</h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">体重（kg）</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="300"
              inputMode="decimal"
              autoFocus
              placeholder="例：62.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-4 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-stone-500 mt-1">毎朝起床後・食事前の測定を推奨</p>
          </div>
          <button
            onClick={save}
            disabled={saving || !weight}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : initialValue ? '✏️ 上書き保存' : '✅ 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseSheet({
  selectedDate,
  lineUserId,
  initialContent,
  hasInitial,
  onClose,
  onSaved,
}: {
  selectedDate: string;
  lineUserId: string;
  initialExercised: boolean;
  initialContent: string;
  hasInitial: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const trimmed = content.trim();
      const exercised = trimmed.length > 0;
      const res = await fetch('/api/log/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          date: selectedDate,
          exercised,
          content: trimmed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={saving ? undefined : onClose}>
      <div
        className={`bg-white shadow-2xl w-full flex flex-col ${
          expanded ? 'h-full rounded-none' : 'rounded-t-2xl max-h-[88vh]'
        }`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...handleProps}
          className="pt-3 pb-2 border-b border-stone-200 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">🏃 運動を記録</h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">運動内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="例：ランニング30分、ジム筋トレ"
              rows={4}
              autoFocus
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
              書いたら「した」として記録。空のまま保存すれば「してない」記録になります
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : hasInitial ? '✏️ 上書き保存' : '✅ 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
