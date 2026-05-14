'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, UtensilsCrossed, Send, Sparkles, UserCog, Building2, ChevronLeft, ChevronDown, type LucideIcon } from 'lucide-react';

type Tab = { href: string; label: string; Icon: LucideIcon; match: (p: string) => boolean; masterOnly?: boolean };

const TABS: Tab[] = [
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
    masterOnly: true,
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
  const [me, setMe] = useState<Me | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  async function switchTenant(tenantId: string) {
    if (!me || tenantId === me.currentTenantId) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/admin/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        // セッション更新後、ページリロードで全データ再取得
        window.location.reload();
      }
    } finally {
      setSwitching(false);
    }
  }

  const visibleTabs = TABS.filter((t) => !t.masterOnly || me?.role === 'master');
  const currentTenantName = me?.availableTenants.find((t) => t.id === me.currentTenantId)?.name || me?.currentTenantId || '';

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
          <div className="flex items-center gap-2 flex-shrink-0">
            {me?.role === 'master' && me.availableTenants.length > 1 && (
              <div className="relative">
                <select
                  value={me.currentTenantId}
                  onChange={(e) => switchTenant(e.target.value)}
                  disabled={switching}
                  className="appearance-none bg-violet-50 border border-violet-200 rounded-full text-[11px] font-bold text-violet-800 pl-2 pr-6 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400 max-w-[140px] truncate"
                  aria-label="テナント切替"
                  title="テナント切替"
                >
                  {me.availableTenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-violet-700 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={2.4} />
              </div>
            )}
            {me?.role === 'master' && me.availableTenants.length <= 1 && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full" title={currentTenantName}>
                マスタ
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
