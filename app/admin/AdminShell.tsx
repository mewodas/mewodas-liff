'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, UtensilsCrossed, Send, Sparkles, UserCog, Building2, ChevronLeft, type LucideIcon } from 'lucide-react';

const TABS: { href: string; label: string; Icon: LucideIcon; match: (p: string) => boolean }[] = [
  {
    href: '/admin',
    label: '顧客',
    Icon: Users,
    match: (p) => p === '/admin' || p.startsWith('/admin/customers'),
  },
  {
    href: '/admin/meals',
    label: '食事管理',
    Icon: UtensilsCrossed,
    match: (p) => p.startsWith('/admin/meals'),
  },
  {
    href: '/admin/reports',
    label: 'レポート送付',
    Icon: Send,
    match: (p) => p.startsWith('/admin/reports') || p.startsWith('/admin/templates'),
  },
  {
    href: '/admin/analysis',
    label: 'AI 分析',
    Icon: Sparkles,
    match: (p) => p.startsWith('/admin/analysis'),
  },
  {
    href: '/admin/staff',
    label: 'スタッフ',
    Icon: UserCog,
    match: (p) => p.startsWith('/admin/staff'),
  },
  {
    href: '/admin/tenants',
    label: 'テナント',
    Icon: Building2,
    match: (p) => p.startsWith('/admin/tenants'),
  },
];

export default function AdminShell({
  title,
  back,
  children,
}: {
  title: string;
  back?: { href: string } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || '';

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {back ? (
              <Link
                href={back.href}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0"
                aria-label="戻る"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
              </Link>
            ) : (
              <Users className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
            )}
            <h1 className="text-sm sm:text-base font-bold text-stone-900 truncate">{title}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2 py-1 rounded-full hover:bg-stone-100"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2.2} />
            ログアウト
          </button>
        </div>
        <nav className="max-w-5xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-1 -mb-px min-w-max">
            {TABS.map((t) => {
              const active = t.match(pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap ${
                    active
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <t.Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.2} />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
