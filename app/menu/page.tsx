'use client';

import Link from 'next/link';
import {
  BookOpen,
  TrendingUp,
  MessageCircle,
  ChefHat,
  TrendingDown,
  Trophy,
  User,
  Target,
  Link as LinkIcon,
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
};

type Section = {
  title: string;
  items: MenuItem[];
};

const sections: Section[] = [
  {
    title: '記録・分析',
    items: [
      { href: '/history', Icon: BookOpen, color: 'text-emerald-600', label: '履歴', sub: '過去の記録を確認' },
      { href: '/weekly', Icon: TrendingUp, color: 'text-emerald-600', label: '週次レポート', sub: '7日間の振り返り' },
    ],
  },
  {
    title: 'AI機能',
    items: [
      { href: '/chat', Icon: MessageCircle, color: 'text-emerald-600', label: 'AI食事相談', sub: '栄養士AIに質問' },
      { href: '/meal-plan', Icon: ChefHat, color: 'text-emerald-600', label: 'AI献立作成', sub: '1日分の献立提案' },
      { href: '/prediction', Icon: TrendingDown, color: 'text-emerald-600', label: '体重推移・予測', sub: 'グラフ＋AI推測' },
    ],
  },
  {
    title: '達成状況',
    items: [
      { href: '/badges', Icon: Trophy, color: 'text-amber-600', label: 'バッジ獲得', sub: '連続記録の振り返り' },
    ],
  },
  {
    title: '設定',
    items: [
      { href: '/menu/profile', Icon: User, color: 'text-stone-500', label: 'プロフィール', sub: '近日対応', disabled: true },
      { href: '/menu/goals', Icon: Target, color: 'text-stone-500', label: '目標設定', sub: '近日対応', disabled: true },
      { href: '/menu/sync', Icon: LinkIcon, color: 'text-stone-500', label: 'データ連携', sub: '近日対応', disabled: true },
    ],
  },
];

export default function MenuPage() {
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <PageHeader title="メニュー" subtitle="すべての機能・設定にアクセス" />

      <main className="px-4 py-5 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-bold text-stone-500 mb-2 px-1">
              {section.title}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {section.items.map((item) => {
                const baseClass =
                  'flex flex-col items-center justify-center bg-white rounded-2xl py-4 px-2 border border-stone-200 shadow-sm';
                const inner = (
                  <>
                    <item.Icon className={`w-7 h-7 ${item.color}`} strokeWidth={2} />
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
