'use client';

import { useRef, useState } from 'react';

export function useDraggableSheet(onClose: () => void) {
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
