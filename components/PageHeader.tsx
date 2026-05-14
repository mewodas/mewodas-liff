'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  /** タイトル左に表示するアイコン（lucide） */
  Icon?: LucideIcon;
  subtitle?: string;
  /** 戻るボタンの挙動：URL指定 / true=router.back() / 省略=非表示。onBack 指定時はこちらを無視 */
  back?: string | true;
  /** カスタム戻る処理（state遷移など）。指定時は back より優先 */
  onBack?: () => void;
  /** ヘッダー右側に表示する任意の要素 */
  rightSlot?: ReactNode;
  /** ヘッダーの下に積む要素（検索バー・タブ等） */
  children?: ReactNode;
};

export default function PageHeader({
  title,
  Icon,
  subtitle,
  back,
  onBack,
  rightSlot,
  children,
}: Props) {
  const router = useRouter();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof back === 'string') {
      router.push(back);
    } else {
      router.back();
    }
  }

  const showBack = !!onBack || !!back;

  return (
    <header className="bg-emerald-500 text-white px-4 pt-5 pb-4 sticky top-0 z-30 shadow">
      <div className="flex items-center justify-between gap-2">
        {showBack ? (
          <button
            onClick={handleBack}
            className="text-white text-sm font-medium w-12 text-left active:opacity-70"
            type="button"
          >
            ← 戻る
          </button>
        ) : (
          <div className="w-12" />
        )}
        <h1 className="text-base font-bold text-white truncate flex-1 text-center flex items-center justify-center gap-1.5">
          {Icon && <Icon className="w-4 h-4" strokeWidth={2.4} />}
          <span className="truncate">{title}</span>
        </h1>
        <div className="w-12 flex justify-end">{rightSlot}</div>
      </div>
      {subtitle && (
        <p className="text-[11px] text-emerald-50 mt-1 text-center">{subtitle}</p>
      )}
      {children}
    </header>
  );
}
