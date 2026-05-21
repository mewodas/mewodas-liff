'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// LIFF Endpoint URL は `/home` 配下に設定されており、`liff.login()` の redirect_uri も
// `/home/...` 配下でないと LINE 側 access.line.me で 400 Bad Request になるため、
// 顧客向け招待トークン引き換え画面は `/home/onboard` に置く。
export default function HomeOnboardPage() {
  return (
    <Suspense fallback={<LoadingState label="読み込み中…" />}>
      <OnboardInner />
    </Suspense>
  );
}

type Phase = 'loading' | 'success' | 'error';

// LINE OAuth コールバック後に URL から token が失われるケースに備えた sessionStorage キー
const SESSION_KEY = 'fitmeal_invite_token';

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

    // URL の token を優先し、なければ sessionStorage から復元
    const effectiveToken = token || (typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) || '' : '');
    if (effectiveToken) {
      // token を sessionStorage に保存（コールバック後の URL で token が失われても復元できる）
      sessionStorage.setItem(SESSION_KEY, effectiveToken);
    }

    if (!effectiveToken) {
      setErrorMsg('招待リンクが無効です。トレーナーに再発行を依頼してください。');
      setPhase('error');
      return;
    }
    (async () => {
      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error('LIFF ID 未設定');
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          // redirectUri を /home/onboard（token なし）に設定することで、
          // LINE が redirect_uri を LIFF Endpoint URL と照合する際に
          // クエリパラメータの干渉を防ぐ。token は sessionStorage で保持済み。
          const redirectUri = `${window.location.origin}/home/onboard`;
          liff.login({ redirectUri });
          return;
        }
        // ログイン成功後に sessionStorage の token を使って処理継続
        const resolvedToken = sessionStorage.getItem(SESSION_KEY) || effectiveToken;
        sessionStorage.removeItem(SESSION_KEY);
        const profile = await liff.getProfile();
        const res = await fetch('/api/onboard/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resolvedToken,
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
        </div>

        {officialLineUrl ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-2">
              <p className="text-sm font-bold text-stone-900">📱 公式LINEを友だち追加してください</p>
              <p className="text-xs text-stone-600 leading-relaxed">
                下のボタンから公式LINEを友だち追加していただくと、
                <br />
                リッチメニューから食事管理のURLにアクセス可能です。
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
