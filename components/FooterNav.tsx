'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items: Array<{ href: string; label: string; icon: string; match: (path: string) => boolean }> = [
  { href: '/home', label: 'ホーム', icon: '🏠', match: (p) => p === '/' || p === '/home' || p.startsWith('/home') },
  {
    href: '/record-menu',
    label: '記録',
    icon: '📝',
    match: (p) =>
      p.startsWith('/record') || p.startsWith('/weight') || p.startsWith('/exercise'),
  },
  { href: '/weekly', label: '週次', icon: '📈', match: (p) => p.startsWith('/weekly') },
  { href: '/history', label: '履歴', icon: '📅', match: (p) => p.startsWith('/history') },
];

export default function FooterNav() {
  const pathname = usePathname() || '/';
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center py-2 ${
                active ? 'text-emerald-700' : 'text-stone-600'
              } active:bg-stone-50`}
            >
              <span className="text-xl leading-none">{it.icon}</span>
              <span className={`text-[10px] mt-1 font-bold ${active ? 'text-emerald-700' : 'text-stone-600'}`}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
