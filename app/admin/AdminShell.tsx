'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, UtensilsCrossed, Send, Sparkles, Store, Building2, ChevronLeft, type LucideIcon } from 'lucide-react';
import { useAdminBase } from '@/lib/useAdminBase';

type Tab = { suffix: string; label: string; Icon: LucideIcon; match: (p: string, base: string) => boolean; masterOnly?: boolean; storeHidden?: boolean };

const TABS: Tab[] = [
  {
    suffix: '',
    label: '顧客',
    Icon: Users,
    match: (p, base) => p === base || p.startsWith(`${base}/customers`),
  },
  {
    suffix: '/meals',
    label: '食事管理',
    Icon: UtensilsCrossed,
    match: (p, base) => p.startsWith(`${base}/meals`),
  },
  {
    suffix: '/reports',
    label: 'レポート送付',
    Icon: Send,
    match: (p, base) => p.startsWith(`${base}/reports`) || p.startsWith(`${base}/templates`),
  },
  {
    suffix: '/analysis',
    label: 'AI 分析',
    Icon: Sparkles,
    match: (p, base) => p.startsWith(`${base}/analysis`),
  },
  {
    suffix: '/stores',
    label: '店舗',
    Icon: Store,
    match: (p, base) => p.startsWith(`${base}/stores`),
  },
  {
    suffix: '/tenants',
    label: 'テナント',
    Icon: Building2,
    match: (p, base) => p.startsWith(`${base}/tenants`),
    masterOnly: true,
    storeHidden: true,
  },
];

type Me = {
  email: string;
  role: 'master' | 'tenant_admin';
  currentTenantId: string;
  availableTenants: { id: string; name: string }[];
};

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
  const base = useAdminBase();
  const isStore = base === '/store';
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace(`${base}/login`);
  }

  const visibleTabs = TABS.filter((t) => {
    if (isStore && t.storeHidden) return false;
    if (t.masterOnly && me?.role !== 'master') return false;
    return true;
  });

  const headerIconColor = isStore ? 'text-violet-600' : 'text-emerald-600';

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
            ) : isStore ? (
              <Store className={`w-5 h-5 ${headerIconColor} flex-shrink-0`} strokeWidth={2.2} />
            ) : (
              <Users className={`w-5 h-5 ${headerIconColor} flex-shrink-0`} strokeWidth={2.2} />
            )}
            <h1 className="text-sm sm:text-base font-bold text-stone-900 truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isStore && me?.role === 'master' && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                マスタ
              </span>
            )}
            {isStore && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                店舗
              </span>
            )}
            <button
              type="button"
              onClick={logout}
              className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2 py-1 rounded-full hover:bg-stone-100"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={2.2} />
              ログアウト
            </button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-1 -mb-px min-w-max">
            {visibleTabs.map((t) => {
              const href = `${base}${t.suffix}`;
              const active = t.match(pathname, base);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap ${
                    active
                      ? isStore
                        ? 'border-violet-600 text-violet-700'
                        : 'border-emerald-600 text-emerald-700'
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
