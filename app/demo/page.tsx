'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { setDemoToken, clearDemoMode } from '@/lib/demoClient';

function DemoPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExit = searchParams.get('exit') === '1';
  const [message, setMessage] = useState('デモを準備中...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isExit) {
      clearDemoMode();
      setMessage('デモを終了しました。');
      setTimeout(() => {
        router.replace('/home');
      }, 1000);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/demo/start');
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { message?: string };
          setError(j.message || 'デモの開始に失敗しました。');
          return;
        }
        const j = await res.json() as { token: string; tenantId: string };
        if (cancelled) return;
        setDemoToken(j.token, j.tenantId);
        router.replace('/home');
      } catch {
        if (!cancelled) setError('ネットワークエラーが発生しました。再度お試しください。');
      }
    })();
    return () => { cancelled = true; };
  }, [isExit, router]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100 px-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center flex flex-col gap-4">
          <p className="text-sm text-stone-600">{error}</p>
          <a
            href="https://fitmeal.jp"
            className="text-xs text-emerald-600 underline"
          >
            FitMeal のサイトへ戻る
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="text-stone-600 text-sm">{message}</div>
    </main>
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-stone-100">
          <div className="text-stone-600 text-sm">読み込み中...</div>
        </main>
      }
    >
      <DemoPageInner />
    </Suspense>
  );
}
