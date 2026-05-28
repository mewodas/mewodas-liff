'use client';

import { useEffect, useState } from 'react';
import { Bell, Inbox, ChevronDown, ChevronUp, AlertTriangle, Pin } from 'lucide-react';
import AdminShell from '@/app/admin/AdminShell';
import { markAnnouncementRead, isAnnouncementRead } from '@/lib/announcementReads';

type AnnouncementImportance = '通常' | '重要';

type Announcement = {
  id: string;
  title: string;
  body: string;
  importance: AnnouncementImportance;
  pinned: boolean;
  publishedAt: string | null;
  status: string;
  targetTenants: string[];
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function StoreAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        setConfigured(j.configured !== false);
        setAnnouncements(j.announcements || []);
        const ids = new Set<string>();
        for (const a of (j.announcements || []) as Announcement[]) {
          if (isAnnouncementRead(a.id, 'store')) ids.add(a.id);
        }
        setReadIds(ids);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggleOpen(a: Announcement) {
    const next = openId === a.id ? null : a.id;
    setOpenId(next);
    if (next === a.id && !readIds.has(a.id)) {
      markAnnouncementRead(a.id, 'store');
      setReadIds((prev) => new Set([...prev, a.id]));
    }
  }

  return (
    <AdminShell title="お知らせ">
      <div className="space-y-3">
        {!configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">
            お知らせ機能は現在設定中です。
          </div>
        )}

        {configured && loading && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-xs text-stone-400">
            読み込み中…
          </div>
        )}

        {configured && !loading && announcements.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6 text-center">
            <Inbox className="w-10 h-10 text-stone-400 mx-auto mb-2" strokeWidth={2} />
            <div className="text-sm font-bold text-stone-800 mb-1">お知らせはありません</div>
            <div className="text-xs text-stone-600 leading-relaxed">
              運営からのお知らせが届くと、ここに表示されます
            </div>
          </div>
        )}

        {configured && !loading && announcements.length > 0 && (
          <ul className="bg-white rounded-2xl shadow-sm border border-stone-200 divide-y divide-stone-100 overflow-hidden">
            {announcements.map((a) => {
              const isRead = readIds.has(a.id);
              const open = openId === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggleOpen(a)}
                    className="w-full px-4 py-3 text-left active:bg-stone-50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!isRead && (
                        <span className="inline-block w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" aria-label="未読" />
                      )}
                      {a.pinned && <Pin className="w-3 h-3 text-violet-600 flex-shrink-0" strokeWidth={2.2} />}
                      {a.importance === '重要' && (
                        <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" strokeWidth={2.2} />
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        <Bell className="w-3 h-3 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                        <span className="text-[11px] text-stone-500">{formatDate(a.publishedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 text-sm font-bold truncate ${
                          isRead ? 'text-stone-600' : 'text-stone-900'
                        }`}
                      >
                        {a.title}
                      </div>
                      {open ? (
                        <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                      )}
                    </div>
                    {open && (
                      <div className="mt-2 text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed">
                        {a.body}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
