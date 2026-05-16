'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Home, UtensilsCrossed, Bell, User } from 'lucide-react';
import { initLiff, getLineProfile } from '@/lib/liff';

type NavItem = {
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
  href: string;
  badgeKey?: string;
};

const ICON_CLASS = 'w-5 h-5';

const items: NavItem[] = [
  {
    href: '/home',
    label: 'ホーム',
    icon: <Home className={ICON_CLASS} strokeWidth={2.2} />,
    match: (p) => p === '/' || p === '/home' || p.startsWith('/home'),
  },
  {
    href: '/record',
    label: '食事記録',
    icon: <UtensilsCrossed className={ICON_CLASS} strokeWidth={2.2} />,
    match: (p) => p.startsWith('/record'),
  },
  {
    href: '/notifications',
    label: 'お知らせ',
    icon: <Bell className={ICON_CLASS} strokeWidth={2.2} />,
    match: (p) => p.startsWith('/notifications') || p.startsWith('/announcements'),
    badgeKey: 'unread',
  },
  {
    href: '/profile',
    label: 'プロフィール',
    icon: <User className={ICON_CLASS} strokeWidth={2.2} />,
    match: (p) => p.startsWith('/profile'),
  },
];

export default function FooterNav() {
  const pathname = usePathname() || '/';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (!profile) return;
        const res = await fetch(
          `/api/notifications?lineUserId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setUnreadCount(j.unreadCount || 0);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 管理者画面・店舗側画面ではフッターナビを非表示
  if (pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/store')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {items.map((it) => {
          const active = it.match(pathname);
          const className = `flex flex-col items-center py-1.5 ${
            active ? 'text-emerald-700' : 'text-stone-500'
          } active:bg-stone-50`;
          const showBadge = it.badgeKey === 'unread' && unreadCount > 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={className}
              data-tour={
                it.href === '/record'
                  ? 'footer-record'
                  : it.href === '/menu'
                  ? 'footer-menu'
                  : undefined
              }
            >
              <span className="relative leading-none flex items-center justify-center h-6">
                {it.icon}
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={`mt-0.5 font-bold text-[9px] leading-tight ${
                  active ? 'text-emerald-700' : 'text-stone-500'
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
