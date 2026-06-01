'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

interface StoreLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/store', label: 'ダッシュボード', icon: '🏠' },
  { href: '/store/customers', label: '顧客一覧', icon: '👥' },
];

const BRAND = 'FitMeal 店舗管理';

export default function StoreLayout({ children }: StoreLayoutProps) {
  // モバイルのみで使うドロワーの開閉状態。md 以上では常時表示のため未使用。
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/store/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/store/login');
      }
    } catch {
      // ignore
    }
  };

  const isActive = (href: string) =>
    href === '/store' ? pathname === '/store' : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* モバイル用オーバーレイ（ドロワー背面） */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* サイドバー: モバイルはドロワー、md 以上は常時固定表示 */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          'md:translate-x-0 md:shadow-none',
        ].join(' ')}
      >
        {/* ブランド */}
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <span className="text-xl">🍱</span>
          <span className="text-base font-bold tracking-tight text-slate-900">
            {BRAND}
          </span>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                  active
                    ? 'bg-blue-50 font-semibold text-blue-700 shadow-[0_2px_12px_-4px_rgba(37,99,235,0.5)] ring-1 ring-blue-100'
                    : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]',
                ].join(' ')}
              >
                {/* 選択中の階層を示す左のアクセントバー（光る表現） */}
                <span
                  className={[
                    'absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-150',
                    active
                      ? 'bg-blue-600 opacity-100 shadow-[0_0_8px_1px_rgba(37,99,235,0.6)]'
                      : 'opacity-0 group-hover:bg-slate-300 group-hover:opacity-100',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ログアウト */}
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="text-base">↩</span>
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインカラム: md 以上はサイドバー幅ぶん左に寄せ、画面全体を使う */}
      <div className="flex min-h-screen flex-col md:pl-64">
        {/* モバイル用トップバー（ハンバーガー）: md 以上では非表示 */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-2 text-2xl leading-none text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="メニューを開く"
          >
            ☰
          </button>
          <span className="text-base font-bold text-slate-900">{BRAND}</span>
        </header>

        {/* コンテンツ */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
