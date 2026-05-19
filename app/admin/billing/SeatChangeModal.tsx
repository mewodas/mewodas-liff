'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Users, ArrowRight, AlertTriangle } from 'lucide-react';

const MIN_SEATS = 3;
const SUPPORT_FEE = 5500;

function getPlanTier(seats: number): string {
  if (seats <= 20) return 'Starter';
  if (seats <= 50) return 'Growth';
  return 'Scale';
}

function getUnitPrice(seats: number): number {
  if (seats <= 20) return 2750;
  if (seats <= 50) return 2200;
  return 1650;
}

function getMonthlyTotal(seats: number): number {
  return SUPPORT_FEE + getUnitPrice(seats) * seats;
}

type Props = {
  currentSeats: number;
  currentUseCount: number;
  onClose: () => void;
  onSuccess: () => void;
};

export default function SeatChangeModal({ currentSeats, currentUseCount, onClose, onSuccess }: Props) {
  const safeMinInit = Math.max(MIN_SEATS, currentUseCount);
  const [newSeats, setNewSeats] = useState(Math.max(currentSeats, safeMinInit));
  const [preview, setPreview] = useState<{ amountDue: number; newTier: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeatsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeMin = safeMinInit;
  const newTier = getPlanTier(newSeats);
  const newMonthly = getMonthlyTotal(newSeats);
  const tierChanged = newSeats !== currentSeats && getPlanTier(newSeats) !== getPlanTier(currentSeats);

  useEffect(() => {
    if (fetchSeatsRef.current) clearTimeout(fetchSeatsRef.current);
    if (newSeats === currentSeats || newSeats < safeMin) return;

    fetchSeatsRef.current = setTimeout(() => {
      setPreviewLoading(true);
      fetch(`/api/stripe/preview-seats?seats=${newSeats}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          if (j.error) throw new Error(j.error);
          setPreview(j);
          setPreviewError(null);
        })
        .catch((e) => {
          setPreview(null);
          setPreviewError(e instanceof Error ? e.message : 'エラー');
        })
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => {
      if (fetchSeatsRef.current) clearTimeout(fetchSeatsRef.current);
    };
  }, [newSeats, currentSeats, safeMin]);

  async function confirmChange() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/update-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: newSeats }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `失敗 (${res.status})`);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Users className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
            席数変更
          </h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        {/* 現在 → 新 */}
        <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-3">
          <div className="text-center">
            <div className="text-[10px] text-stone-500 font-bold mb-0.5">現在</div>
            <div className="text-xl font-bold text-stone-900">{currentSeats}名</div>
            <div className="text-[10px] text-stone-500">{getPlanTier(currentSeats)}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
          <div className="text-center">
            <div className="text-[10px] text-stone-500 font-bold mb-0.5">変更後</div>
            <div className="text-xl font-bold text-emerald-700">{newSeats}名</div>
            <div className={`text-[10px] font-bold ${tierChanged ? 'text-emerald-600' : 'text-stone-500'}`}>
              {newTier}{tierChanged && ' (変更)'}
            </div>
          </div>
        </div>

        {/* スピナー */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => setNewSeats(Math.max(safeMin, newSeats - 1))}
              className="w-10 h-10 bg-stone-100 rounded-xl active:bg-stone-200 text-xl font-bold flex-shrink-0"
            >
              −
            </button>
            <input
              type="number"
              value={newSeats}
              min={safeMin}
              onChange={(e) => setNewSeats(Math.max(safeMin, parseInt(e.target.value, 10) || safeMin))}
              className="flex-1 text-center text-lg font-bold bg-stone-50 border border-stone-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setNewSeats(newSeats + 1)}
              className="w-10 h-10 bg-stone-100 rounded-xl active:bg-stone-200 text-xl font-bold flex-shrink-0"
            >
              ＋
            </button>
          </div>
          <div className="text-[10px] text-stone-500">
            ミニマム {safeMin}名（使用中 {currentUseCount}名）
          </div>
        </div>

        {/* 新月額 */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <div className="text-xs text-stone-700 font-bold mb-0.5">変更後の月額（目安）</div>
          <div className="text-2xl font-bold text-emerald-700">¥{newMonthly.toLocaleString()}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">サポート費¥5,500 + per-user合計（税込）</div>
        </div>

        {/* 日割り差額プレビュー */}
        {newSeats !== currentSeats && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
            <div className="text-xs font-bold text-stone-700 mb-0.5">今月の日割り差額（即時請求）</div>
            {previewLoading ? (
              <div className="text-xs text-stone-500">計算中…</div>
            ) : previewError ? (
              <div className="text-[11px] text-amber-800 inline-flex gap-1 items-center">
                <AlertTriangle className="w-3 h-3" strokeWidth={2.2} />
                {previewError}
              </div>
            ) : preview ? (
              <div className="text-xl font-bold text-sky-700">
                {preview.amountDue >= 0
                  ? `+¥${preview.amountDue.toLocaleString()}`
                  : `-¥${Math.abs(preview.amountDue).toLocaleString()}`}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-stone-100 text-stone-900 font-bold py-3 rounded-xl active:bg-stone-200 text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={confirmChange}
            disabled={confirming || newSeats === currentSeats || newSeats < safeMin}
            className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 text-sm"
          >
            {confirming ? '処理中…' : '変更を確定'}
          </button>
        </div>
      </div>
    </div>
  );
}
