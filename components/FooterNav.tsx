'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { Home, UtensilsCrossed, MessageCircle, LayoutGrid } from 'lucide-react';

type NavItem = {
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
  href: string;
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
    href: '/chat',
    label: 'AI相談',
    icon: <MessageCircle className={ICON_CLASS} strokeWidth={2.2} />,
    match: (p) => p.startsWith('/chat'),
  },
  {
    href: '/menu',
    label: 'メニュー',
    icon: <LayoutGrid className={ICON_CLASS} strokeWidth={2.2} />,
    match: (p) =>
      p.startsWith('/menu') ||
      p.startsWith('/weekly') ||
      p.startsWith('/history'),
  },
];

export default function FooterNav() {
  const pathname = usePathname() || '/';

  // 管理者画面・店舗側画面ではフッターナビを非表示
  if (pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/store')) return null;
  // 招待トークン引き換え（LINE認証オンボーディング）画面ではフッターナビを非表示。
  // 認証完了後は「公式LINE 友だち追加」だけを次のアクションにし、
  // フッターからプロダクトへ直行できる導線を塞ぐ。
  if (pathname === '/onboard' || pathname.startsWith('/home/onboard')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {items.map((it) => {
          const active = it.match(pathname);
          const className = `flex flex-col items-center py-1.5 ${
            active ? 'text-emerald-700' : 'text-stone-500'
          } active:bg-stone-50`;
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
              <span className="leading-none flex items-center justify-center h-6">
                {it.icon}
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
