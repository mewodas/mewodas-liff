'use client';

import Link from 'next/link';
import FooterNav from '@/components/FooterNav';

type MenuItem = {
  href: string;
  icon: string;
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
      { href: '/history', icon: '📖', label: '履歴', sub: '過去の記録を確認' },
      { href: '/weekly', icon: '📈', label: '週次レポート', sub: '7日間の振り返り' },
    ],
  },
  {
    title: 'AI機能',
    items: [
      { href: '/chat', icon: '💬', label: 'AI食事相談', sub: '栄養士AIに質問' },
      { href: '/meal-plan', icon: '🍱', label: 'AI献立作成', sub: '1日分の献立提案' },
      { href: '/prediction', icon: '📉', label: '体重推移・予測', sub: 'グラフ＋AI推測' },
    ],
  },
  {
    title: '達成状況',
    items: [
      { href: '/badges', icon: '🏆', label: 'バッジ獲得', sub: '連続記録の振り返り' },
    ],
  },
  {
    title: '設定',
    items: [
      { href: '/menu/profile', icon: '👤', label: 'プロフィール', sub: '近日対応', disabled: true },
      { href: '/menu/goals', icon: '🎯', label: '目標設定', sub: '近日対応', disabled: true },
      { href: '/menu/sync', icon: '🔗', label: 'データ連携', sub: '近日対応', disabled: true },
    ],
  },
];

export default function MenuPage() {
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <header className="bg-emerald-600 text-white px-4 pt-6 pb-5 shadow">
        <h1 className="text-xl font-bold">メニュー</h1>
        <p className="text-xs text-emerald-50 mt-1">すべての機能・設定にアクセス</p>
      </header>

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
                    <span className="text-2xl">{item.icon}</span>
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
          <p>メヲダス LIFF v1.0</p>
        </section>
      </main>

      <FooterNav />
    </div>
  );
}
