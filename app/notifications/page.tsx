'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff, getLineProfile } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import { getReadAnnouncementIds, markAnnouncementRead } from '@/lib/announcementReads';
import PageHeader from '@/components/PageHeader';
import { Bell, FileText, Sparkles, Inbox, ChevronDown, ChevronUp, Megaphone, AlertTriangle } from 'lucide-react';

type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  source: 'notification';
};

type AnnouncementItem = {
  id: string;
  category: 'お知らせ';
  title: string;
  body: string;
  read: boolean;
  readAt: null;
  createdAt: string;
  source: 'announcement';
  importance: '通常' | '重要';
};

type InboxItem = NotificationItem | AnnouncementItem;

const TABS = ['すべて', '前日レポート', '週次レポート', 'お知らせ'] as const;
type Tab = typeof TABS[number];

function matchTab(tab: Tab, item: InboxItem): boolean {
  if (tab === 'すべて') return true;
  if (tab === '前日レポート') return item.category === '前日レポート';
  if (tab === '週次レポート') return item.category === '週次レポート';
  if (tab === 'お知らせ') return item.category === 'お知らせ' || item.category === 'アドバイス';
  return false;
}

function formatDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    try {
      const [, m, d] = iso.split('-').map(Number);
      return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  }
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function NotificationsPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('すべて');

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (!profile) {
          setError('LINEプロフィール取得失敗');
          setReady(true);
          return;
        }
        setUserId(profile.userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const [notifRes, annRes] = await Promise.all([
          apiFetch(`/api/notifications?t=${Date.now()}`, { cache: 'no-store' }),
          apiFetch(`/api/announcements?t=${Date.now()}`, { cache: 'no-store' }),
        ]);

        let notifItems: NotificationItem[] = [];
        let notifConfigured = true;
        if (notifRes.ok) {
          const j = await notifRes.json();
          notifConfigured = !!j.configured;
          notifItems = (j.notifications || []).map((n: Omit<NotificationItem, 'source'>) => ({
            ...n,
            source: 'notification' as const,
          }));
        }

        let annItems: AnnouncementItem[] = [];
        if (annRes.ok) {
          const j = await annRes.json();
          const readIds = getReadAnnouncementIds('customer');
          annItems = (j.announcements || []).map((a: { id: string; title: string; body: string; importance: '通常' | '重要'; publishedAt: string | null }) => ({
            id: a.id,
            category: 'お知らせ' as const,
            title: a.title,
            body: a.body,
            read: readIds.has(a.id),
            readAt: null,
            createdAt: a.publishedAt || '',
            source: 'announcement' as const,
            importance: a.importance,
          }));
        }

        const merged: InboxItem[] = [...notifItems, ...annItems].sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return b.createdAt.localeCompare(a.createdAt);
        });

        setConfigured(notifConfigured);
        setItems(merged);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setReady(true);
      }
    })();
  }, [userId]);

  async function toggleOpen(item: InboxItem) {
    const next = openId === item.id ? null : item.id;
    setOpenId(next);
    if (next === item.id && !item.read) {
      if (item.source === 'notification') {
        try {
          await apiFetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST' });
          setItems((arr) => arr.map((x): InboxItem => {
            if (x.id !== item.id) return x;
            if (x.source === 'notification') return { ...x, read: true, readAt: new Date().toISOString() };
            return { ...x, read: true };
          }));
        } catch {
          // ignore
        }
      } else {
        markAnnouncementRead(item.id, 'customer');
        setItems((arr) => arr.map((x): InboxItem => (x.id === item.id ? { ...x, read: true } : x)));
      }
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  const filtered = items.filter((n) => matchTab(activeTab, n));
  const unreadTotal = items.filter((n) => !n.read).length;

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="レポート" Icon={Bell} subtitle="トレーナーからの連絡" back />
      <div className="max-w-md mx-auto px-4 pt-3 pb-4 space-y-3">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {configured && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            {TABS.map((tab) => {
              const tabUnread = tab === 'すべて'
                ? unreadTotal
                : items.filter((n) => !n.read && matchTab(tab, n)).length;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-stone-700 border-stone-300 active:bg-stone-50'
                  }`}
                >
                  {tab}
                  {tabUnread > 0 && (
                    <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                      active ? 'bg-white text-emerald-700' : 'bg-rose-500 text-white'
                    }`}>
                      {tabUnread > 9 ? '9+' : tabUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!configured ? (
          <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6 text-center">
            <Inbox className="w-10 h-10 text-stone-400 mx-auto mb-2" strokeWidth={2} />
            <div className="text-sm font-bold text-stone-800 mb-1">レポート機能は準備中です</div>
            <div className="text-xs text-stone-600 leading-relaxed">設定完了後にここに表示されます</div>
            <Link href="/home" className="inline-block mt-4 text-xs font-bold text-emerald-700 underline">
              ホームに戻る
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6 text-center">
            <Inbox className="w-10 h-10 text-stone-400 mx-auto mb-2" strokeWidth={2} />
            <div className="text-sm font-bold text-stone-800 mb-1">
              {activeTab === 'すべて' ? 'まだレポートはありません' : `「${activeTab}」のレポートはありません`}
            </div>
            <div className="text-xs text-stone-600 leading-relaxed">
              トレーナーからレポートが届くと、ここに表示されます
            </div>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl shadow-md border border-stone-200 divide-y divide-stone-100 overflow-hidden">
            {filtered.map((n) => {
              const open = openId === n.id;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => toggleOpen(n)}
                    className="w-full px-4 py-3 text-left active:bg-stone-50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!n.read && (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" aria-label="未読" />
                      )}
                      <CategoryBadge item={n} />
                      <span className="text-[11px] text-stone-500">{formatDate(n.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 text-sm font-bold truncate ${
                          n.read ? 'text-stone-600' : 'text-stone-900'
                        }`}
                      >
                        {n.title}
                      </div>
                      {open ? (
                        <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                      )}
                    </div>
                    {open && (
                      <div className="mt-2 text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed">
                        {n.body}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function CategoryBadge({ item }: { item: InboxItem }) {
  if (item.source === 'announcement') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-sky-100 text-sky-700 border-sky-300">
        <Megaphone className="w-3 h-3" strokeWidth={2.4} />
        お知らせ
        {item.importance === '重要' && (
          <span className="ml-0.5 inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600">
            <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.4} />
            重要
          </span>
        )}
      </span>
    );
  }
  const { category } = item;
  const cls =
    category === '前日レポート' || category === '週次レポート'
      ? 'bg-sky-100 text-sky-700 border-sky-300'
      : category === 'アドバイス'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : 'bg-stone-100 text-stone-700 border-stone-300';
  const Icon =
    category === '前日レポート' || category === '週次レポート'
      ? FileText
      : category === 'アドバイス'
      ? Sparkles
      : Bell;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cls}`}>
      <Icon className="w-3 h-3" strokeWidth={2.4} />
      {category}
    </span>
  );
}
