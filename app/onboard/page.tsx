'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function OnboardPage() {
  return (
    <Suspense fallback={<LoadingState label="読み込み中…" />}>
      <OnboardInner />
    </Suspense>
  );
}

type Phase = 'loading' | 'success' | 'error';

function OnboardInner() {
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const [phase, setPhase] = useState<Phase>('loading');
  const [customerName, setCustomerName] = useState('');
  const [officialLineUrl, setOfficialLineUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setErrorMsg('招待リンクが無効です。トレーナーに再発行を依頼してください。');
      setPhase('error');
      return;
    }
    (async () => {
      try {
        // LIFF SDK を動的インポート（SSR 対策）
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error('LIFF ID 未設定');
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const profile = await liff.getProfile();
        const res = await fetch('/api/onboard/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            lineUserId: profile.userId,
            displayName: profile.displayName,
          }),
        });
        const j = await res.json();
        if (!res.ok) {
          setErrorMsg(j.error || '登録に失敗しました');
          setPhase('error');
          return;
        }
        setCustomerName(j.customerName || '');
        setOfficialLineUrl(j.officialLineUrl || '');
        setPhase('success');
        // 自動遷移はやめて、ユーザーが「友達追加」or「ホームへ」を選ぶ
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : '予期しないエラーが発生しました');
        setPhase('error');
      }
    })();
  }, [token]);

  if (phase === 'loading') return <LoadingState label="アプリに登録中…" />;
  if (phase === 'success') {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-stone-900">
            {customerName ? `${customerName}様` : ''}　登録が完了しました
          </p>
          <p className="text-sm text-stone-600 mt-1">最後にあと1ステップだけお願いします</p>
        </div>

        {officialLineUrl ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-2">
              <p className="text-sm font-bold text-stone-900">📱 公式LINEを友だち追加してください</p>
              <p className="text-xs text-stone-600 leading-relaxed">
                下のボタンから公式LINEを友だち追加していただくと、リッチメニューから食事管理のURLにアクセス可能です。
              </p>
            </div>
            <a
              href={officialLineUrl}
              className="block w-full bg-emerald-500 text-white text-center font-bold py-3 rounded-xl active:bg-emerald-700 text-sm"
            >
              ✅ 公式LINEを友だち追加する
            </a>
          </div>
        ) : (
          <div className="text-center text-xs text-stone-500 max-w-sm">
            公式LINEの友だち追加URLが未設定です。トレーナーへお問い合わせください。
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 gap-5">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center max-w-xs">
        <p className="text-base font-bold text-stone-900">登録できませんでした</p>
        <p className="text-sm text-stone-600 mt-2">{errorMsg}</p>
      </div>
      <a
        href="/apply"
        className="bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl text-sm active:bg-emerald-700"
      >
        申込フォームへ
      </a>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-stone-600 font-bold">{label}</p>
    </div>
  );
}
