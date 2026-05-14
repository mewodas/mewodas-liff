'use client';

import { useRef, useState } from 'react';

export function useDraggableSheet(onClose: () => void) {
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
    // 下方向（dy > 0）のみ追従、上方向は無視
    setDragOffset(Math.max(0, dy));
  }
  function onPointerUp() {
    if (startY.current === null) return;
    if (dragOffset > 80) {
      onClose();
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

  // 既存の呼び出し側との互換性のため expanded は常に false で返す
  return { expanded: false as const, handleProps, sheetStyle };
}
