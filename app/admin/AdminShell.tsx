'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, Send, Sparkles, Building2, Store, ChevronLeft, Key, FileText, Menu, X, CreditCard, ListChecks, Rocket, TrendingUp, Bell, ShieldCheck, Settings, ChevronDown, Scale, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useStoreAnnouncementUnread } from '@/lib/useStoreAnnouncementUnread';
import { useAdminBase } from '@/lib/useAdminBase';

type Tab = { suffix: string; label: string; Icon: LucideIcon; match: (p: string, base: string) => boolean; masterOnly?: boolean; storeHidden?: boolean; storeOnly?: boolean; settings?: boolean; progress?: boolean };

const TABS: Tab[] = [
  {
    suffix: '/customers',
    label: '顧客管理',
    Icon: Users,
    match: (p, base) => p === base || p.startsWith(`${base}/customers`),
  },
  {
    suffix: '/progress',
    label: '進捗管理',
    Icon: TrendingUp,
    match: (p, base) => p.startsWith(`${base}/progress`),
    progress: true,
  },
  {
    suffix: '/meals',
    label: '食事一覧',
    Icon: UtensilsCrossed,
    match: (p, base) => p.startsWith(`${base}/meals`),
    progress: true,
  },
  {
    suffix: '/measurements',
    label: '体組成計測記録',
    Icon: Scale,
    match: (p, base) => p.startsWith(`${base}/measurements`),
    progress: true,
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
  // --- 以下は「設定」ドロップダウン配下に表示 ---
  // store 表示順: LINE連携設定 → 契約 → テンプレ管理 → 店舗
  // admin 表示順: テンプレ管理 → テナント → プラン管理 → 監査ログ
  {
    suffix: '/onboarding',
    label: 'LINE連携設定',
    Icon: Rocket,
    match: (p, base) => p.startsWith(`${base}/onboarding`),
    storeOnly: true,
    settings: true,
  },
  {
    suffix: '/billing',
    label: '契約管理',
    Icon: CreditCard,
    match: (p, base) => p.startsWith(`${base}/billing`),
    storeOnly: true,
    settings: true,
  },
  {
    suffix: '/templates',
    label: 'テンプレ管理',
    Icon: FileText,
    match: (p, base) => p.startsWith(`${base}/templates`),
    settings: true,
  },
  {
    suffix: '/stores',
    label: '店舗一覧',
    Icon: Store,
    match: (p, base) => p.startsWith(`${base}/stores`),
    storeOnly: true,
    settings: true,
  },
  {
    suffix: '/tenants',
    label: 'テナント',
    Icon: Building2,
    match: (p, base) => p.startsWith(`${base}/tenants`),
    masterOnly: true,
    storeHidden: true,
    settings: true,
  },
  {
    suffix: '/plans',
    label: 'プラン管理',
    Icon: ListChecks,
    match: (p, base) => p.startsWith(`${base}/plans`),
    masterOnly: true,
    storeHidden: true,
    settings: true,
  },
  {
    suffix: '/audit',
    label: '監査ログ',
    Icon: ShieldCheck,
    match: (p, base) => p.startsWith(`${base}/audit`),
    masterOnly: true,
    storeHidden: true,
    settings: true,
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
  const [openMenu, setOpenMenu] = useState<'progress' | 'settings' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
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
    setOpenMenu(null);
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

  useEffect(() => {
    if (!openMenu) return;
    function handleClick(e: MouseEvent) {
      const insideProgress = progressRef.current && progressRef.current.contains(e.target as Node);
      const insideSettings = settingsRef.current && settingsRef.current.contains(e.target as Node);
      if (!insideProgress && !insideSettings) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

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

  const topTabs = visibleTabs.filter((t) => !t.settings && !t.progress);
  const progressTabs = visibleTabs.filter((t) => t.progress);
  const settingsTabs = visibleTabs.filter((t) => t.settings);

  const activeTab = visibleTabs.find((t) => t.match(pathname, base));
  const progressActive = progressTabs.some((t) => t.match(pathname, base));
  const settingsActive = settingsTabs.some((t) => t.match(pathname, base));
  const accentBorder = isStore ? 'border-violet-600' : 'border-emerald-600';
  const accentText = isStore ? 'text-violet-700' : 'text-emerald-700';
  const accentBg = isStore ? 'bg-violet-50' : 'bg-emerald-50';
  const accentDot = isStore ? 'bg-violet-600' : 'bg-emerald-600';

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
              <img src="/fitmeal-icon.png" alt="" className="h-10 w-10 object-contain" />
              <img src="/fitmeal-wordmark.png" alt="fitmeal" className="-ml-2 h-6 w-auto" />
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
        <nav className="hidden sm:block max-w-5xl mx-auto px-4 overflow-visible">
          <div className="flex gap-1 -mb-px min-w-max">
            {topTabs.map((t) => {
              const href = `${base}${t.suffix}`;
              const active = t.match(pathname, base);
              return (
                <Fragment key={href}>
                  <Link
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

                  {/* 進捗管理ドロップダウン（顧客管理の直後に配置） */}
                  {t.suffix === '/customers' && progressTabs.length > 0 && (
                    <div className="relative" ref={progressRef}>
                      <button
                        type="button"
                        onClick={() => setOpenMenu((v) => (v === 'progress' ? null : 'progress'))}
                        aria-expanded={openMenu === 'progress'}
                        aria-haspopup="true"
                        className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap ${
                          progressActive || openMenu === 'progress'
                            ? `${accentBorder} ${accentText}`
                            : 'border-transparent text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.2} />
                        進捗管理
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${openMenu === 'progress' ? 'rotate-180' : ''}`}
                          strokeWidth={2.2}
                        />
                      </button>
                      {openMenu === 'progress' && (
                        <div className="absolute left-0 top-full mt-1 z-40 min-w-[12rem] rounded-xl border border-stone-200 bg-white shadow-lg py-1.5">
                          {progressTabs.map((pt) => {
                            const phref = `${base}${pt.suffix}`;
                            const pactive = pt.match(pathname, base);
                            return (
                              <Link
                                key={phref}
                                href={phref}
                                className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold ${
                                  pactive ? `${accentBg} ${accentText}` : 'text-stone-700 hover:bg-stone-50'
                                }`}
                              >
                                <pt.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                                {pt.label}
                                {pactive && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} />}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}

            {/* 設定ドロップダウン */}
            {settingsTabs.length > 0 && (
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setOpenMenu((v) => (v === 'settings' ? null : 'settings'))}
                  aria-expanded={openMenu === 'settings'}
                  aria-haspopup="true"
                  className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap ${
                    settingsActive || openMenu === 'settings'
                      ? `${accentBorder} ${accentText}`
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.2} />
                  設定
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${openMenu === 'settings' ? 'rotate-180' : ''}`}
                    strokeWidth={2.2}
                  />
                </button>
                {openMenu === 'settings' && (
                  <div className="absolute left-0 top-full mt-1 z-40 min-w-[12rem] rounded-xl border border-stone-200 bg-white shadow-lg py-1.5">
                    {settingsTabs.map((t) => {
                      const href = `${base}${t.suffix}`;
                      const active = t.match(pathname, base);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold ${
                            active ? `${accentBg} ${accentText}` : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                          {t.label}
                          {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* モバイル用ドロップダウンメニュー */}
        {menuOpen && (
          <div className="sm:hidden border-t border-stone-100 bg-white shadow-lg">
            <nav className="px-3 py-2 space-y-0.5">
              {topTabs.map((t) => {
                const href = `${base}${t.suffix}`;
                const active = t.match(pathname, base);
                return (
                  <Fragment key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm ${
                        active
                          ? `${accentBg} ${accentText}`
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                      {t.label}
                      {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} />}
                    </Link>

                    {/* 進捗管理セクション（顧客管理の直後に配置） */}
                    {t.suffix === '/customers' && progressTabs.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 px-3 pb-1 text-[11px] font-bold text-stone-400 uppercase tracking-wide">
                          <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.2} />
                          進捗管理
                        </div>
                        {progressTabs.map((pt) => {
                          const phref = `${base}${pt.suffix}`;
                          const pactive = pt.match(pathname, base);
                          return (
                            <Link
                              key={phref}
                              href={phref}
                              className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm ${
                                pactive
                                  ? `${accentBg} ${accentText}`
                                  : 'text-stone-700 hover:bg-stone-50'
                              }`}
                            >
                              <pt.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                              {pt.label}
                              {pactive && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </Fragment>
                );
              })}

              {/* 設定セクション */}
              {settingsTabs.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 px-3 pb-1 text-[11px] font-bold text-stone-400 uppercase tracking-wide">
                    <Settings className="w-3.5 h-3.5" strokeWidth={2.2} />
                    設定
                  </div>
                  {settingsTabs.map((t) => {
                    const href = `${base}${t.suffix}`;
                    const active = t.match(pathname, base);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm ${
                          active
                            ? `${accentBg} ${accentText}`
                            : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                        {t.label}
                        {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} />}
                      </Link>
                    );
                  })}
                </div>
              )}
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
