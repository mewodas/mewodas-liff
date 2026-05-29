'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, Send, Sparkles, Building2, Store, ChevronLeft, Key, FileText, Menu, X, CreditCard, ListChecks, Rocket, TrendingUp, Bell, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useStoreAnnouncementUnread } from '@/lib/useStoreAnnouncementUnread';
import { useAdminBase } from '@/lib/useAdminBase';

type Tab = { suffix: string; label: string; Icon: LucideIcon; match: (p: string, base: string) => boolean; masterOnly?: boolean; storeHidden?: boolean; storeOnly?: boolean };

const TABS: Tab[] = [
  {
    suffix: '/customers',
    label: '顧客設定',
    Icon: Users,
    match: (p, base) => p === base || p.startsWith(`${base}/customers`),
  },
  {
    suffix: '/progress',
    label: '進捗管理',
    Icon: TrendingUp,
    match: (p, base) => p.startsWith(`${base}/progress`),
  },
  {
    suffix: '/analysis',
    label: '顧客分析',
    Icon: Sparkles,
    match: (p, base) => p.startsWith(`${base}/analysis`),
  },
  {
    suffix: '/reports',
    label: 'レポート送付',
    Icon: Send,
    match: (p, base) => p.startsWith(`${base}/reports`),
  },
  {
    suffix: '/templates',
    label: 'テンプレ管理',
    Icon: FileText,
    match: (p, base) => p.startsWith(`${base}/templates`),
  },
  {
    suffix: '/billing',
    label: '契約',
    Icon: CreditCard,
    match: (p, base) => p.startsWith(`${base}/billing`),
    storeOnly: true,
  },
  {
    suffix: '/stores',
    label: '店舗',
    Icon: Store,
    match: (p, base) => p.startsWith(`${base}/stores`),
    storeOnly: true,
  },
  {
    suffix: '/onboarding',
    label: 'セットアップ',
    Icon: Rocket,
    match: (p, base) => p.startsWith(`${base}/onboarding`),
    storeOnly: true,
  },
  {
    suffix: '/tenants',
    label: 'テナント',
    Icon: Building2,
    match: (p, base) => p.startsWith(`${base}/tenants`),
    masterOnly: true,
    storeHidden: true,
  },
  {
    suffix: '/plans',
    label: 'プラン管理',
    Icon: ListChecks,
    match: (p, base) => p.startsWith(`${base}/plans`),
    masterOnly: true,
    storeHidden: true,
  },
  {
    suffix: '/audit',
    label: '監査ログ',
    Icon: ShieldCheck,
    match: (p, base) => p.startsWith(`${base}/audit`),
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

// AdminShell はページごとに個別マウントされるため、ページ遷移のたびに me が
// null へリセットされ右上要素がちらつく。module スコープにキャッシュして
// 再マウント時は即座に前回値で描画する。
let cachedMe: Me | null = null;

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
  const [me, setMe] = useState<Me | null>(cachedMe);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const storeUnread = useStoreAnnouncementUnread();

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          cachedMe = j;
          setMe(j);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace(`${base}/login`);
  }

  const visibleTabs = TABS.filter((t) => {
    if (isStore && t.storeHidden) return false;
    if (!isStore && t.storeOnly) return false;
    if (t.masterOnly && me?.role !== 'master') return false;
    return true;
  });

  const activeTab = visibleTabs.find((t) => t.match(pathname, base));
  const accentBorder = isStore ? 'border-violet-600' : 'border-emerald-600';
  const accentText = isStore ? 'text-violet-700' : 'text-emerald-700';

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30" ref={menuRef}>
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {back && (
              <Link
                href={back.href}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0"
                aria-label="戻る"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
              </Link>
            )}
            {/* FitMeal ロゴ（HPと同じ）。クリックで進捗管理へ */}
            <Link
              href={`${base}/progress`}
              className="flex items-center flex-shrink-0"
              aria-label="進捗管理へ"
            >
              <img src="/fitmeal-icon.png" alt="" className="h-8 w-8 object-contain" />
              <img src="/fitmeal-wordmark.png" alt="fitmeal" className="-ml-1.5 h-5 w-auto" />
            </Link>
            <span className="h-5 w-px bg-stone-200 flex-shrink-0" aria-hidden />
            <h1 className="text-sm font-bold text-stone-900 truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isStore && (
              <span className="hidden sm:inline text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                アドミン
              </span>
            )}
            {isStore && (
              <span className="hidden sm:inline text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                店舗
              </span>
            )}
            {isStore && (
              <Link
                href="/store/announcements"
                className="relative flex w-8 h-8 items-center justify-center rounded-full hover:bg-stone-100 text-stone-600"
                aria-label={`お知らせ（未読${storeUnread}件）`}
              >
                <Bell className="w-4 h-4" strokeWidth={2.2} />
                {storeUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white">
                    {storeUnread > 9 ? '9+' : storeUnread}
                  </span>
                )}
              </Link>
            )}
            {me?.role === 'tenant_admin' && (
              <Link
                href={`${base}/account/password`}
                className="hidden sm:inline-flex text-xs font-bold text-stone-600 hover:text-stone-900 items-center gap-1 p-2 rounded-full hover:bg-stone-100"
                title="パスワード変更"
              >
                <Key className="w-3.5 h-3.5" strokeWidth={2.2} />
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="hidden sm:flex text-xs font-bold text-stone-600 hover:text-stone-900 items-center gap-1 px-2 py-1.5 rounded-full hover:bg-stone-100"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={2.2} />
              ログアウト
            </button>
            {/* ハンバーガーボタン (sm 以下のみ表示) */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-700"
              aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            >
              {menuOpen ? <X className="w-5 h-5" strokeWidth={2.2} /> : <Menu className="w-5 h-5" strokeWidth={2.2} />}
            </button>
          </div>
        </div>

        {/* デスクトップ用タブナビ */}
        <nav className="hidden sm:block max-w-5xl mx-auto px-4 overflow-x-auto overflow-y-hidden">
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
                      ? `${accentBorder} ${accentText}`
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

        {/* モバイル用ドロップダウンメニュー */}
        {menuOpen && (
          <div className="sm:hidden border-t border-stone-100 bg-white shadow-lg">
            <nav className="px-3 py-2 space-y-0.5">
              {visibleTabs.map((t) => {
                const href = `${base}${t.suffix}`;
                const active = t.match(pathname, base);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm ${
                      active
                        ? isStore
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-emerald-50 text-emerald-700'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                    {t.label}
                    {active && (
                      <span className={`ml-auto w-1.5 h-1.5 rounded-full ${isStore ? 'bg-violet-600' : 'bg-emerald-600'}`} />
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-stone-100 px-3 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isStore && (
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                    アドミン
                  </span>
                )}
                {isStore && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    店舗
                  </span>
                )}
                {me?.role === 'tenant_admin' && (
                  <Link
                    href={`${base}/account/password`}
                    className="text-xs font-bold text-stone-600 inline-flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-stone-100"
                    title="パスワード変更"
                  >
                    <Key className="w-3.5 h-3.5" strokeWidth={2.2} />
                    パスワード変更
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-bold text-stone-600 flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-stone-100"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={2.2} />
                ログアウト
              </button>
            </div>
          </div>
        )}

        {/* モバイル用アクティブタブ表示バー */}
        {!menuOpen && activeTab && (
          <div className={`sm:hidden border-t border-stone-100 px-3 py-1.5 flex items-center gap-2 ${accentText}`}>
            <activeTab.Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
            <span className="text-xs font-bold">{activeTab.label}</span>
          </div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4">{children}</main>
    </div>
  );
}
