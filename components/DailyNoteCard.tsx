'use client';

import { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const MAX_NOTE_LENGTH = 2000;

/**
 * その日1件の自由メモ（備考）を入力・表示するカード。
 * 自己完結型：選択日が変わるたびに自分で取得し、保存も自分で行う。
 * テナントに日次備考DBが割り当てられていない場合（enabled:false）は何も描画しない。
 */
export default function DailyNoteCard({
  selectedDate,
  isToday,
  lineUserId,
}: {
  selectedDate: string;
  isToday: boolean;
  lineUserId: string;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/daily-note?date=${selectedDate}&t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setEnabled(false);
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        setEnabled(!!j.enabled);
        setNote(j.note || '');
        setSavedValue(j.note || '');
      } catch {
        if (!cancelled) setEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, lineUserId]);

  // 機能が無効なテナントでは何も描画しない（カードごと非表示）
  if (enabled === false) return null;

  const dirty = note.trim() !== savedValue.trim();
  const [, mm, dd] = selectedDate.split('-');
  const heading = isToday ? '今日の備考' : `${parseInt(mm, 10)}月${parseInt(dd, 10)}日の備考`;

  async function save() {
    if (saving || !dirty) return;
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
      setNote(value);
      setSavedValue(value);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-stone-200">
      <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-1.5">
        <StickyNote className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
        {heading}
      </h2>

      {loading ? (
        <div className="h-[92px] rounded-xl bg-stone-50 border border-stone-200 animate-pulse" />
      ) : (
        <>
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl mb-2">
              {error}
            </div>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
            placeholder="体調・気づき・トレーナーへの連絡など自由に記入"
            rows={3}
            className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-stone-400">
              {note.length}/{MAX_NOTE_LENGTH}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="bg-emerald-500 text-white text-sm font-bold px-5 py-2 rounded-2xl active:bg-emerald-700 disabled:opacity-40"
            >
              {saving ? '保存中…' : savedFlash ? '保存しました' : savedValue ? '上書き保存' : '保存'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
