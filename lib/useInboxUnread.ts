'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { getReadAnnouncementIds } from '@/lib/announcementReads';

export function useInboxUnread(userId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [notifRes, annRes] = await Promise.all([
          apiFetch(`/api/notifications?t=${Date.now()}`, { cache: 'no-store' }),
          apiFetch(`/api/announcements?t=${Date.now()}`, { cache: 'no-store' }),
        ]);
        if (cancelled) return;

        let notifUnread = 0;
        if (notifRes.ok) {
          const j = await notifRes.json();
          notifUnread = j.unreadCount ?? 0;
        }

        let annUnread = 0;
        if (annRes.ok) {
          const j = await annRes.json();
          const readIds = getReadAnnouncementIds('customer');
          const anns: { id: string }[] = j.announcements ?? [];
          annUnread = anns.filter((a) => !readIds.has(a.id)).length;
        }

        if (!cancelled) setCount(notifUnread + annUnread);
      } catch {
        // ネットワーク失敗・LIFF未初期化時は 0 を維持
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return count;
}
