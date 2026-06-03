'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users, Send, Sparkles, Building2, Store, ChevronLeft, Key, FileText, Menu, X, CreditCard, ListChecks, Rocket, TrendingUp, Bell, BellRing, ShieldCheck, Settings, ChevronDown, Scale, UtensilsCrossed, type LucideIcon } from 'lucide-react';
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
  // --- 以下は「設定」グループ配下に表示 ---
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
    suffix: '/notifications',
    label: '通知設定',
    Icon: BellRing,
    match: (p, base) => p.startsWith(`${base}/notifications`),
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
  // モバイル(< md)用ドロワーの開閉。md 以上ではサイドバー常時表示のため未使用。
  // ナビ各リンクの onClick で閉じるため、遷移時クローズの effect は不要。
  const [drawerOpen, setDrawerOpen] = useState(false);
  // サイドバー内グループ(進捗管理 / 設定)の手動展開トグル。実際の表示は
  // 「手動で開いた || 現在地がそのグループ」で算出する（下記 progressOpen / settingsOpen）。
  const [openGroups, setOpenGroups] = useState<{ progress: boolean; settings: boolean }>({ progress: false, settings: false });
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

  const progressActive = progressTabs.some((t) => t.match(pathname, base));
  const settingsActive = settingsTabs.some((t) => t.match(pathname, base));

  // グループの展開状態 = 手動で開いた || 現在地がそのグループ。
  // アクティブなグループは常に開き、それ以外はユーザーのトグルに従う（離れると自動で畳む）。
  const progressOpen = openGroups.progress || progressActive;
  const settingsOpen = openGroups.settings || settingsActive;
  // 排他ハイライト: いずれかのグループが開いている間はトップ項目（顧客管理等）の色を消し、
  // 「展開した親のみ色／子クリックで親＋子」の単一フォーカス表示にする。
  const anyGroupOpen = progressOpen || settingsOpen;

  // アクセントカラー（store=emerald緑 / admin=violet紫）。選択中の「光る」表現に使用。
  const accentText = isStore ? 'text-emerald-700' : 'text-violet-700';
  const accentBg = isStore ? 'bg-emerald-50' : 'bg-violet-50';
  const accentDot = isStore ? 'bg-emerald-600' : 'bg-violet-600';
  const accentRing = isStore ? 'ring-emerald-200' : 'ring-violet-200';
  const accentGlow = isStore
    ? 'shadow-[0_1px_10px_-3px_rgba(5,150,105,0.55)]'
    : 'shadow-[0_1px_10px_-3px_rgba(124,58,237,0.55)]';

  // リンク項目の共通クラス。active のとき背景＋リング＋グローで強調。
  const leafClass = (active: boolean, indented: boolean) =>
    [
      'group relative flex items-center gap-3 rounded-xl py-2.5 text-base font-bold transition-all',
      indented ? 'pl-10 pr-3' : 'px-3',
      active
        ? `${accentBg} ${accentText} ring-1 ${accentRing} ${accentGlow}`
        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    ].join(' ');

  return (
    <div className="min-h-screen bg-stone-100">
      {/* モバイル用ドロワー背面オーバーレイ */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* サイドバー: モバイルはドロワー / md 以上は常時固定表示 */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-stone-200 bg-white',
          'transition-transform duration-200 ease-out md:w-60 lg:w-64',
          drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          'md:translate-x-0 md:shadow-none',
        ].join(' ')}
      >
        {/* ブランド + ロール */}
        <div className="flex h-16 items-center border-b border-stone-200 px-4">
          <Link
            href={`${base}/progress`}
            className="mr-auto flex items-center min-w-0"
            aria-label="進捗管理へ"
            onClick={() => setDrawerOpen(false)}
          >
            <img src="/fitmeal-icon.png" alt="" className="h-12 w-12 object-contain" />
            <img src="/fitmeal-wordmark.png" alt="fitmeal" className="-ml-1.5 h-7 w-auto" />
          </Link>
          {/* モバイル: 閉じる */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-600"
            aria-label="メニューを閉じる"
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {topTabs.map((t) => {
            const href = `${base}${t.suffix}`;
            const active = t.match(pathname, base);
            // 排他ハイライト: グループ展開中はトップ項目の色を消す（現在地の色は消える仕様）
            const highlighted = active && !anyGroupOpen;
            return (
              <Fragment key={href}>
                <Link
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={leafClass(highlighted, false)}
                >
                  <span
                    className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all ${
                      highlighted ? `${accentDot} opacity-100` : 'opacity-0 group-hover:opacity-40 group-hover:bg-stone-400'
                    }`}
                    aria-hidden
                  />
                  <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                  <span className="truncate">{t.label}</span>
                  {highlighted && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} aria-hidden />}
                </Link>

                {/* 進捗管理グループ（顧客管理の直後に配置） */}
                {t.suffix === '/customers' && progressTabs.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenGroups(() => ({ progress: !progressOpen, settings: false }))}
                      aria-expanded={progressOpen}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-bold transition-all ${
                        progressOpen ? `${accentBg} ${accentText}` : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${progressActive ? `${accentDot} opacity-100` : 'opacity-0'}`}
                        aria-hidden
                      />
                      <TrendingUp className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                      <span className="flex-1 text-left">進捗管理</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${progressOpen ? 'rotate-180' : ''}`}
                        strokeWidth={2.2}
                      />
                    </button>
                    {progressOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        {progressTabs.map((pt) => {
                          const phref = `${base}${pt.suffix}`;
                          const pactive = pt.match(pathname, base);
                          return (
                            <Link
                              key={phref}
                              href={phref}
                              onClick={() => setDrawerOpen(false)}
                              aria-current={pactive ? 'page' : undefined}
                              className={leafClass(pactive, true)}
                            >
                              <pt.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                              <span className="truncate">{pt.label}</span>
                              {pactive && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} aria-hidden />}
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

          {/* 設定グループ */}
          {settingsTabs.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setOpenGroups(() => ({ settings: !settingsOpen, progress: false }))}
                aria-expanded={settingsOpen}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-bold transition-all ${
                  settingsOpen ? `${accentBg} ${accentText}` : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span
                  className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${settingsActive ? `${accentDot} opacity-100` : 'opacity-0'}`}
                  aria-hidden
                />
                <Settings className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                <span className="flex-1 text-left">設定</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2.2}
                />
              </button>
              {settingsOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {settingsTabs.map((t) => {
                    const href = `${base}${t.suffix}`;
                    const active = t.match(pathname, base);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDrawerOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={leafClass(active, true)}
                      >
                        <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                        <span className="truncate">{t.label}</span>
                        {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accentDot}`} aria-hidden />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* フッター: アカウント / ログアウト */}
        <div className="border-t border-stone-200 p-3 space-y-1">
          {me?.role === 'tenant_admin' && (
            <Link
              href={`${base}/account/password`}
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-bold text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <Key className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
              パスワード変更
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-bold text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
            ログアウト
          </button>
          {me?.email && <p className="px-3 pt-1 text-[11px] text-stone-400 truncate">{me.email}</p>}
        </div>
      </aside>

      {/* メインカラム: md 以上はサイドバー幅ぶん左に寄せ、画面全体を使う */}
      <div className="flex min-h-screen flex-col md:pl-60 lg:pl-64">
        {/* トップバー */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-stone-200 bg-white/90 px-3 backdrop-blur sm:px-4">
          {/* モバイル: ハンバーガー */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden -ml-1 w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-700"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5" strokeWidth={2.2} />
          </button>
          {back && (
            <Link
              href={back.href}
              className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0"
              aria-label="戻る"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
            </Link>
          )}
          <h1 className="flex-1 min-w-0 truncate text-base font-bold text-stone-900">{title}</h1>
          {isStore && (
            <Link
              href="/store/announcements"
              className="relative flex w-9 h-9 items-center justify-center rounded-full hover:bg-stone-100 text-stone-600"
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
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
              isStore
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-violet-700 bg-violet-50 border-violet-200'
            }`}
          >
            {isStore ? <Store className="w-4 h-4" strokeWidth={2.2} /> : <ShieldCheck className="w-4 h-4" strokeWidth={2.2} />}
            {isStore ? '店舗' : 'アドミン'}
          </span>
        </header>

        {/* コンテンツ: 大画面でも中央寄せの余白を作らず幅いっぱいに使う（PCサイズと同じ見え方） */}
        <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-4">{children}</main>
      </div>
    </div>
  );
}
