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
        // 受信ベルは運営→店舗の「店舗向け」のみカウント（店舗自身が送った顧客向けは除外）
        const announcements: { id: string; audience?: string }[] = j.announcements ?? [];
        if (cancelled) return;
        const readIds = getReadAnnouncementIds('store');
        setCount(
          announcements.filter((a) => a.audience === '店舗向け' && !readIds.has(a.id)).length
        );
      } catch {
        // ネットワーク失敗時は 0 を維持
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return count;
}
