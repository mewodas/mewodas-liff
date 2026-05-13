'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

type NavItem = {
  label: string;
  icon: string;
  match: (path: string) => boolean;
} & ({ href: string } | { action: 'open-record-sheet' });

const items: NavItem[] = [
  {
    href: '/home',
    label: 'ホーム',
    icon: '🏠',
    match: (p) => p === '/' || p === '/home' || p.startsWith('/home'),
  },
  {
    action: 'open-record-sheet',
    label: '記録',
    icon: '📝',
    match: (p) =>
      p.startsWith('/record') || p.startsWith('/weight') || p.startsWith('/exercise'),
  },
  { href: '/weekly', label: '週次', icon: '📈', match: (p) => p.startsWith('/weekly') },
  { href: '/history', label: '履歴', icon: '📅', match: (p) => p.startsWith('/history') },
];

export default function FooterNav() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [sheetOpen, setSheetOpen] = useState(false);

  function go(href: string) {
    setSheetOpen(false);
    router.push(href);
  }

  return (
    <>
      {sheetOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[60]"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-5 pb-24"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-stone-900 mb-4 text-center">
              📝 何を記録する？
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => go('/record')}
                className="flex flex-col items-center bg-emerald-50 border border-emerald-300 rounded-2xl py-4 active:bg-emerald-100"
              >
                <span className="text-3xl">🍽️</span>
                <span className="text-sm font-bold text-stone-900 mt-2">食事</span>
              </button>
              <button
                onClick={() => go('/weight')}
                className="flex flex-col items-center bg-sky-50 border border-sky-300 rounded-2xl py-4 active:bg-sky-100"
              >
                <span className="text-3xl">⚖️</span>
                <span className="text-sm font-bold text-stone-900 mt-2">体重</span>
              </button>
              <button
                onClick={() => go('/exercise')}
                className="flex flex-col items-center bg-amber-50 border border-amber-300 rounded-2xl py-4 active:bg-amber-100"
              >
                <span className="text-3xl">🏃</span>
                <span className="text-sm font-bold text-stone-900 mt-2">運動</span>
              </button>
            </div>
            <button
              onClick={() => setSheetOpen(false)}
              className="w-full mt-4 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl active:bg-stone-200"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {items.map((it) => {
            const active = it.match(pathname);
            const className = `flex flex-col items-center py-2 ${
              active ? 'text-emerald-700' : 'text-stone-600'
            } active:bg-stone-50`;
            const inner = (
              <>
                <span className="text-xl leading-none">{it.icon}</span>
                <span
                  className={`text-[10px] mt-1 font-bold ${
                    active ? 'text-emerald-700' : 'text-stone-600'
                  }`}
                >
                  {it.label}
                </span>
              </>
            );
            if ('action' in it) {
              return (
                <button
                  key={it.label}
                  onClick={() => setSheetOpen(true)}
                  className={className}
                  type="button"
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link key={it.href} href={it.href} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
