'use client';

import { useEffect, useState } from 'react';
import { getReadAnnouncementIds } from '@/lib/announcementReads';

export function useStoreAnnouncementUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const announcements: { id: string }[] = j.announcements ?? [];
        if (cancelled) return;
        const readIds = getReadAnnouncementIds('store');
        setCount(announcements.filter((a) => !readIds.has(a.id)).length);
      } catch {
        // ネットワーク失敗時は 0 を維持
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return count;
}
