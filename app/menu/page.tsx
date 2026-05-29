'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff, getLineProfile } from '@/lib/liff';
import { useInboxUnread } from '@/lib/useInboxUnread';
import {
  BookOpen,
  TrendingUp,
  MessageCircle,
  ChefHat,
  TrendingDown,
  Trophy,
  User,
  Link as LinkIcon,
  ClipboardList,
  Sparkles,
  Settings,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import FooterNav from '@/components/FooterNav';
import PageHeader from '@/components/PageHeader';

type MenuItem = {
  href: string;
  Icon: LucideIcon;
  color: string;
  label: string;
  sub?: string;
  disabled?: boolean;
  showUnread?: boolean;
};

type Section = {
  title: string;
  Icon: LucideIcon;
  iconColor: string;
  items: MenuItem[];
};

const sections: Section[] = [
  {
    title: '記録・分析',
    Icon: ClipboardList,
    iconColor: 'text-emerald-600',
    items: [
      { href: '/history', Icon: BookOpen, color: 'text-emerald-600', label: '履歴', sub: '過去の記録を確認' },
      { href: '/weekly', Icon: TrendingUp, color: 'text-emerald-600', label: '週次分析', sub: '7日間の振り返り' },
      { href: '/prediction', Icon: TrendingDown, color: 'text-emerald-600', label: '体重記録', sub: '過去記録とAI予測' },
    ],
  },
  {
    title: 'AI機能',
    Icon: Sparkles,
    iconColor: 'text-violet-600',
    items: [
      { href: '/chat', Icon: MessageCircle, color: 'text-emerald-600', label: 'AI食事相談', sub: '栄養士AIに質問' },
      { href: '/meal-plan', Icon: ChefHat, color: 'text-emerald-600', label: 'AI献立作成', sub: '1日分の献立提案' },
    ],
  },
  {
    title: '達成状況',
    Icon: Trophy,
    iconColor: 'text-amber-600',
    items: [
      { href: '/badges', Icon: Trophy, color: 'text-amber-600', label: 'バッジ獲得', sub: '連続記録の振り返り' },
    ],
  },
  {
    title: '設定',
    Icon: Settings,
    iconColor: 'text-stone-500',
    items: [
      { href: '/profile', Icon: User, color: 'text-emerald-600', label: 'プロフィール', sub: '登録情報・目標を確認' },
      { href: '/notifications', Icon: Bell, color: 'text-sky-600', label: 'レポート', sub: 'トレーナーからの連絡', showUnread: true },
      { href: '/menu/sync', Icon: LinkIcon, color: 'text-stone-500', label: 'データ連携', sub: '近日対応', disabled: true },
    ],
  },
];

export default function MenuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const unreadCount = useInboxUnread(userId);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <PageHeader title="メニュー" subtitle="すべての機能・設定にアクセス" />

      <main className="px-4 py-5 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-bold text-stone-500 mb-2 px-1 flex items-center gap-1.5">
              <section.Icon className={`w-4 h-4 ${section.iconColor}`} strokeWidth={2.4} />
              {section.title}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {section.items.map((item) => {
                const baseClass =
                  'flex flex-col items-center justify-center bg-white rounded-2xl py-4 px-2 border border-stone-200 shadow-sm';
                const hasUnread = item.showUnread && unreadCount > 0;
                const inner = (
                  <>
                    <div className="relative">
                      <item.Icon className={`w-7 h-7 ${item.color}`} strokeWidth={2} />
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" aria-label="未読あり" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-stone-900 mt-2 text-center leading-tight">
                      {item.label}
                    </span>
                    {item.sub && (
                      <span className="text-[10px] text-stone-500 mt-1 text-center leading-tight">
                        {item.sub}
                      </span>
                    )}
                  </>
                );
                if (item.disabled) {
                  return (
                    <div
                      key={item.label}
                      className={`${baseClass} opacity-50`}
                    >
                      {inner}
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`${baseClass} active:bg-emerald-50`}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <section className="mt-8 text-center text-xs text-stone-400">
          <p>FitMeal v1.0</p>
        </section>
      </main>

      <FooterNav />
    </div>
  );
}
