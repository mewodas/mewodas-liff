'use client';

import { useRouter } from 'next/navigation';
import { clearDemoMode } from '@/lib/demoClient';

export default function DemoBanner() {
  const router = useRouter();

  function handleExit() {
    clearDemoMode();
    router.push('/demo?exit=1');
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-400 text-amber-900 text-xs font-medium flex items-center justify-between px-4 py-2 gap-2">
      <span>デモモード（保存はできません）</span>
      <button
        type="button"
        onClick={handleExit}
        className="text-xs font-bold underline whitespace-nowrap"
      >
        デモを終了
      </button>
    </div>
  );
}
