'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function OnboardTestInner() {
  const sp = useSearchParams();
  const tenantId = sp.get('tenantId') || '';
  const token = sp.get('t') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('LINE 認証中…');

  useEffect(() => {
    if (!tenantId || !token) {
      setStatus('error');
      setMessage('パラメータが不足しています。ウィザードからリンクを再発行してください。');
      return;
    }

    (async () => {
      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;

        const configRes = await fetch(`/api/public/tenant-config?tenantId=${encodeURIComponent(tenantId)}`);
        const configJson = configRes.ok ? await configRes.json() : null;
        const liffId = configJson?.liffId ?? process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error('LIFF ID が取得できませんでした');

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await liff.getProfile();
        const userId = profile.userId;

        const res = await fetch('/api/public/onboarding/owner-userid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, token, userId }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || `登録失敗 (${res.status})`);
        }

        setStatus('success');
        setMessage('LINE ユーザー ID の取得が完了しました。ウィザード画面に戻って「テスト送信」ボタンを押してください。');
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : '予期しないエラーが発生しました');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4 text-center">
        <div className="text-sm font-bold text-stone-700">FitMeal セットアップ</div>
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto" strokeWidth={2} />
            <p className="text-sm text-stone-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" strokeWidth={2} />
            <p className="text-sm text-stone-700 font-bold">取得完了</p>
            <p className="text-xs text-stone-600">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" strokeWidth={2} />
            <p className="text-sm text-stone-700 font-bold">エラー</p>
            <p className="text-xs text-stone-600">{message}</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function OnboardTestPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-stone-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" strokeWidth={2} />
        </main>
      }
    >
      <OnboardTestInner />
    </Suspense>
  );
}
