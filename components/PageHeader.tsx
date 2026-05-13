'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  /** 戻るボタンの挙動：URL指定 / true=router.back() / 省略=非表示 */
  back?: string | true;
  /** ヘッダー右側に表示する任意の要素 */
  rightSlot?: ReactNode;
  /** ヘッダーの下に積む要素（検索バー・タブ等） */
  children?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  back,
  rightSlot,
  children,
}: Props) {
  const router = useRouter();

  function handleBack() {
    if (typeof back === 'string') {
      router.push(back);
    } else {
      router.back();
    }
  }

  return (
    <header className="bg-white border-b border-stone-200 px-4 pt-5 pb-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-2">
        {back ? (
          <button
            onClick={handleBack}
            className="text-stone-700 text-sm font-medium w-12 text-left active:text-emerald-700"
            type="button"
          >
            ← 戻る
          </button>
        ) : (
          <div className="w-12" />
        )}
        <h1 className="text-base font-bold text-stone-900 truncate flex-1 text-center">
          {title}
        </h1>
        <div className="w-12 flex justify-end">{rightSlot}</div>
      </div>
      {subtitle && (
        <p className="text-[11px] text-stone-500 mt-1 text-center">{subtitle}</p>
      )}
      {children}
    </header>
  );
}
