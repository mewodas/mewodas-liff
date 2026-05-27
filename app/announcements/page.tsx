'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import PageHeader from '@/components/PageHeader';
import FooterNav from '@/components/FooterNav';
import { Megaphone, Pin, AlertTriangle, Inbox, ChevronDown, ChevronUp } from 'lucide-react';

type Announcement = {
  id: string;
  title: string;
  body: string;
  importance: '通常' | '重要';
  pinned: boolean;
  publishedAt: string | null;
  publishUntil: string | null;
  targetTenants: string[];
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function AnnouncementsPage() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const res = await apiFetch(`/api/announcements?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setConfigured(!!j.configured);
        setItems(j.announcements || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  function toggleOpen(id: string) {
    setOpenId(openId === id ? null : id);
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="お知らせ" Icon={Megaphone} subtitle="運営からのお知らせ" back />
      <div className="max-w-md mx-auto px-4 pt-3 pb-4 space-y-3">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {!configured ? (
          <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6 text-center">
            <Inbox className="w-10 h-10 text-stone-400 mx-auto mb-2" strokeWidth={2} />
            <div className="text-sm font-bold text-stone-800 mb-1">お知らせ機能は準備中です</div>
            <div className="text-xs text-stone-600 leading-relaxed">設定完了後にここに表示されます</div>
            <Link href="/home" className="inline-block mt-4 text-xs font-bold text-emerald-700 underline">
              ホームに戻る
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6 text-center">
            <Inbox className="w-10 h-10 text-stone-400 mx-auto mb-2" strokeWidth={2} />
            <div className="text-sm font-bold text-stone-800 mb-1">まだお知らせはありません</div>
            <div className="text-xs text-stone-600 leading-relaxed">
              運営からのお知らせが届くと、ここに表示されます
            </div>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl shadow-md border border-stone-200 divide-y divide-stone-100 overflow-hidden">
            {items.map((a) => {
              const open = openId === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggleOpen(a.id)}
                    className="w-full px-4 py-3 text-left active:bg-stone-50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {a.pinned && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-300">
                          <Pin className="w-3 h-3" strokeWidth={2.4} />
                          ピン留め
                        </span>
                      )}
                      {a.importance === '重要' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-rose-100 text-rose-700 border-rose-300">
                          <AlertTriangle className="w-3 h-3" strokeWidth={2.4} />
                          重要
                        </span>
                      )}
                      {a.publishedAt && (
                        <span className="text-[11px] text-stone-500 ml-auto">
                          {formatDate(a.publishedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-sm font-bold text-stone-900 truncate">{a.title}</div>
                      {open ? (
                        <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={2.2} />
                      )}
                    </div>
                    {open && a.body && (
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
      <FooterNav />
    </main>
  );
}
