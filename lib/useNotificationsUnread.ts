'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';

export function useNotificationsUnread(userId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/notifications?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setCount(j.unreadCount ?? 0);
      } catch {
        // ネットワーク失敗・LIFF未初期化時は 0 を維持
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return count;
}
