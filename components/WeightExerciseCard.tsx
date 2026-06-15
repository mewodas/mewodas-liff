'use client';

import { useEffect, useState } from 'react';
import { Scale, Footprints, ClipboardList, StickyNote } from 'lucide-react';
import { useDraggableSheet } from '@/lib/useDraggableSheet';
import { apiFetch } from '@/lib/apiFetch';

const MAX_NOTE_LENGTH = 2000;

export type WeightExerciseUpdate = {
  weight?: string;
  exercised?: string;
  exerciseContent?: string;
};

export default function WeightExerciseCard({
  selectedDate,
  isToday,
  lineUserId,
  initialWeight,
  initialExercised,
  initialExerciseContent,
  enableNote = false,
  onUpdated,
}: {
  selectedDate: string;
  isToday: boolean;
  lineUserId: string;
  initialWeight?: string;
  initialExercised?: string;
  initialExerciseContent?: string;
  /** 体重・運動の下に「備考」タイルを表示する（ホームのみ true）。テナントに日次備考DBが
   *  割り当てられていない場合は、この値に関わらず自動で非表示。 */
  enableNote?: boolean;
  onUpdated: (next?: WeightExerciseUpdate) => void;
}) {
  const [weightOpen, setWeightOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteEnabled, setNoteEnabled] = useState(false);
  const [note, setNote] = useState('');

  // 備考はその日1件。選択日が変わるたびに自分で取得する（体重・運動の表示には影響させない）。
  useEffect(() => {
    if (!enableNote) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/daily-note?date=${selectedDate}&t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        setNoteEnabled(!!j.enabled);
        setNote(j.note || '');
      } catch {
        /* 備考の取得失敗はサイレント */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, enableNote]);

  const hasWeight = !!initialWeight;
  const exercised = initialExercised === '✅';
  const hasExercise = !!initialExercised;

  const [, mm, dd] = selectedDate.split('-');
  const heading = isToday ? '今日の記録' : `${parseInt(mm, 10)}月${parseInt(dd, 10)}日の記録`;

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <ClipboardList className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
        {heading}
      </h2>
      <div className="grid grid-cols-2 gap-2 items-stretch">
        <button
          type="button"
          onClick={() => setWeightOpen(true)}
          className={`flex flex-col items-start text-left rounded-xl p-3 border active:bg-stone-50 min-h-[78px] ${
            hasWeight ? 'bg-sky-50 border-sky-300' : 'bg-stone-50 border-stone-200 border-dashed'
          }`}
        >
          <div className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.2} />
            体重
          </div>
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
          <div className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
            <Footprints className="w-3.5 h-3.5 text-amber-600" strokeWidth={2.2} />
            運動
          </div>
          <div className="flex-1 flex items-center w-full min-w-0">
            {hasExercise ? (
              initialExerciseContent ? (
                <span className="text-sm font-bold text-stone-900 line-clamp-2 leading-snug w-full break-words whitespace-pre-line">
                  {initialExerciseContent.replace(/\s*\/\s*/g, '\n')}
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

      {enableNote && noteEnabled && (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className={`w-full mt-2 flex flex-col items-start text-left rounded-xl p-3 border active:bg-stone-50 ${
            note ? 'bg-emerald-50 border-emerald-300' : 'bg-stone-50 border-stone-200 border-dashed'
          }`}
        >
          <div className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
            <StickyNote className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
            備考
          </div>
          <div className="w-full">
            {note ? (
              <span className="text-sm text-stone-900 line-clamp-2 leading-snug w-full break-words whitespace-pre-line">
                {note}
              </span>
            ) : (
              <span className="text-xs text-stone-500">タップで入力</span>
            )}
          </div>
        </button>
      )}

      {weightOpen && (
        <WeightSheet
          selectedDate={selectedDate}
          lineUserId={lineUserId}
          initialValue={initialWeight || ''}
          onClose={() => setWeightOpen(false)}
          onSaved={(next) => {
            setWeightOpen(false);
            onUpdated(next);
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
          onSaved={(next) => {
            setExerciseOpen(false);
            onUpdated(next);
          }}
        />
      )}

      {noteOpen && (
        <NoteSheet
          selectedDate={selectedDate}
          initialValue={note}
          onClose={() => setNoteOpen(false)}
          onSaved={(value) => {
            setNote(value);
            setNoteOpen(false);
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
  onSaved: (next: WeightExerciseUpdate) => void;
}) {
  const [weight, setWeight] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);

  function save() {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 300) {
      setError('体重を 0〜300 の数値で入力してください');
      return;
    }
    setError(null);
    // バグ②対策: 保存前に入力フィールドのフォーカスを外してソフトキーボードを閉じる。
    // キーボードを閉じるタイミングとシートのアンマウントが重なると iOS Safari が
    // ページを下にスクロールさせる既知の問題を回避する。
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    // 楽観的: シート即時閉じる + UI 即時反映。POST は background で投げる
    onSaved({ weight: String(w) });
    apiFetch('/api/log/weight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, weight: w }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `保存失敗（${res.status}）`);
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-alert
        alert(`体重保存に失敗しました: ${e instanceof Error ? e.message : '送信エラー'}`);
      });
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
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-600" strokeWidth={2.2} />
              体重を記録
            </h2>
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
            type="button"
            onClick={save}
            disabled={saving || !weight}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : initialValue ? '上書き保存' : '保存'}
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
  onSaved: (next: WeightExerciseUpdate) => void;
}) {
  const initialItems = initialContent
    ? initialContent
        .split(/\r?\n|\s*\/\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];
  const [items, setItems] = useState<string[]>(initialItems);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);

  function addItem() {
    const t = draft.trim();
    if (!t) return;
    setItems((prev) => [...prev, t]);
    setDraft('');
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    setError(null);
    const pending = draft.trim();
    const allItems = pending ? [...items, pending] : items;
    const merged = allItems.join('\n');
    const exercised = allItems.length > 0;
    // バグ②対策: 保存前に入力フィールドのフォーカスを外してソフトキーボードを閉じる
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    // 楽観的: シート即時閉じる + UI 即時反映。POST は background で投げる
    onSaved({
      exercised: exercised ? '✅' : '',
      exerciseContent: merged,
    });
    apiFetch('/api/log/exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        exercised,
        content: merged,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `保存失敗（${res.status}）`);
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-alert
        alert(`運動保存に失敗しました: ${e instanceof Error ? e.message : '送信エラー'}`);
      });
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
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
              運動を記録
            </h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">運動内容</label>
            {items.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {items.map((it, idx) => (
                  <li
                    key={`${idx}-${it}`}
                    className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                  >
                    <span className="text-[10px] font-bold text-amber-700 mt-0.5 shrink-0">{idx + 1}.</span>
                    <span className="text-sm text-stone-900 flex-1 break-words whitespace-pre-wrap leading-snug">
                      {it}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-stone-400 text-lg leading-none px-1 shrink-0"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder={items.length === 0 ? '例：ランニング30分' : '例：筋トレ40分'}
                rows={1}
                autoFocus
                className="flex-1 bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              />
              <button
                type="button"
                onClick={addItem}
                disabled={!draft.trim()}
                className="shrink-0 bg-amber-500 text-white text-xs font-bold px-3 rounded-xl active:bg-amber-700 disabled:bg-stone-300 min-h-[44px]"
              >
                追加
              </button>
            </div>
            <p className="text-[10px] text-stone-500 mt-1.5 leading-relaxed">
              1項目ずつ入力して「追加」。空のまま保存すれば「してない」記録になります
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : hasInitial ? '上書き保存' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteSheet({
  selectedDate,
  initialValue,
  onClose,
  onSaved,
}: {
  selectedDate: string;
  initialValue: string;
  onClose: () => void;
  onSaved: (note: string) => void;
}) {
  const [note, setNote] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);

  async function save() {
    if (saving) return;
    // 保存前に入力フィールドのフォーカスを外してソフトキーボードを閉じる（iOS スクロール暴れ対策）
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    setSaving(true);
    setError(null);
    const value = note.trim();
    try {
      const res = await apiFetch('/api/daily-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, note: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
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
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              備考を記録
            </h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">その日の備考（任意）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              placeholder="体調・気づき・トレーナーへの連絡など自由に記入"
              rows={5}
              autoFocus
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-stone-500 mt-1 text-right">
              {note.length}/{MAX_NOTE_LENGTH}
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : initialValue ? '上書き保存' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
