'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  QrCode,
  Send,
  Settings,
} from 'lucide-react';
import AdminShell from '@/app/admin/AdminShell';
import { useToast } from '@/components/Toast';

type OnboardingState = {
  step: number;
  liffId: string | null;
  channelTokenVerified: boolean;
  richMenuId: string | null;
  ownerLineUserId: string | null;
  onboardingCompletedAt: string | null;
  gymName: string;
  tenantId: string;
};

type Phase =
  | 'loading'
  | 'wizard'
  | 'complete';

// ステップ定義
const STEPS = [
  { label: 'はじめに' },
  { label: 'LINE 連携' },
  { label: 'リッチメニュー' },
  { label: 'ブランド設定' },
  { label: '動作テスト' },
];

const APP_DOMAIN = 'https://app.fitmeal.jp';

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              i < current
                ? 'bg-emerald-500 text-white'
                : i === current
                ? 'bg-violet-600 text-white'
                : 'bg-stone-200 text-stone-500'
            }`}
          >
            {i < current ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> : i + 1}
          </div>
          <span
            className={`text-[10px] font-bold hidden sm:inline whitespace-nowrap ${
              i === current ? 'text-violet-700' : i < current ? 'text-emerald-700' : 'text-stone-400'
            }`}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`w-4 h-0.5 shrink-0 ${i < current ? 'bg-emerald-400' : 'bg-stone-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg hover:bg-violet-100 active:bg-violet-200 shrink-0"
    >
      <Copy className="w-3 h-3" strokeWidth={2.2} />
      {copied ? 'コピー済み' : 'コピー'}
    </button>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex gap-2 items-start">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
      <div>{children}</div>
    </div>
  );
}

export default function OnboardingPage() {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('loading');
  const [state, setState] = useState<OnboardingState | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // step 1 state
  const [liffIdInput, setLiffIdInput] = useState('');
  const [channelTokenInput, setChannelTokenInput] = useState('');
  const [verifyingLiff, setVerifyingLiff] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [liffVerified, setLiffVerified] = useState(false);
  const [tokenVerifiedInfo, setTokenVerifiedInfo] = useState<{
    botName: string;
    basicId: string | null;
    officialLineUrl: string | null;
  } | null>(null);

  // step 2 state
  const [buildingMenu, setBuildingMenu] = useState(false);
  const [openLabel, setOpenLabel] = useState('アプリを開く');
  const [registerLabel, setRegisterLabel] = useState('新規登録');

  // step 4 state
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [issuingToken, setIssuingToken] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  const [refreshingOwner, setRefreshingOwner] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch('/api/store/onboarding/state', { cache: 'no-store' });
      if (!res.ok) throw new Error('状態取得失敗');
      const j = (await res.json()) as OnboardingState;
      setState(j);
      if (j.onboardingCompletedAt) {
        setPhase('complete');
      } else {
        const savedStep = j.step ?? 0;
        setCurrentStep(savedStep);
        setLiffVerified(!!j.liffId);
        setPhase('wizard');
      }
    } catch {
      setPhase('wizard');
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function saveStep(step: number) {
    await fetch('/api/store/onboarding/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
  }

  async function goNext() {
    const next = currentStep + 1;
    setCurrentStep(next);
    await saveStep(next);
    void loadState();
  }

  async function goBack() {
    const prev = Math.max(0, currentStep - 1);
    setCurrentStep(prev);
    await saveStep(prev);
  }

  async function verifyLiff() {
    if (!liffIdInput.trim()) return;
    setVerifyingLiff(true);
    try {
      const res = await fetch('/api/store/onboarding/verify-liff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liffId: liffIdInput.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setLiffVerified(true);
      setState((s) => s ? { ...s, liffId: liffIdInput.trim() } : s);
      toast.success('LIFF ID を保存しました');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'LIFF ID 検証失敗');
    } finally {
      setVerifyingLiff(false);
    }
  }

  async function verifyToken() {
    if (!channelTokenInput.trim()) return;
    setVerifyingToken(true);
    try {
      const res = await fetch('/api/store/onboarding/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelToken: channelTokenInput.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setTokenVerifiedInfo({
        botName: j.botName,
        basicId: j.basicId,
        officialLineUrl: j.officialLineUrl,
      });
      setState((s) => s ? { ...s, channelTokenVerified: true } : s);
      toast.success(`${j.botName ?? 'LINE Bot'} に接続しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'トークン検証失敗');
    } finally {
      setVerifyingToken(false);
    }
  }

  async function buildRichMenu() {
    setBuildingMenu(true);
    try {
      const res = await fetch('/api/store/onboarding/build-richmenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buttonLabels: { open: openLabel, register: registerLabel },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setState((s) => s ? { ...s, richMenuId: j.richMenuId } : s);
      toast.success('リッチメニューを構築しました');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'リッチメニュー構築失敗');
    } finally {
      setBuildingMenu(false);
    }
  }

  async function issueTestToken() {
    setIssuingToken(true);
    try {
      const res = await fetch('/api/store/onboarding/issue-test-token', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setTestUrl(j.testUrl as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'テストリンク発行失敗');
    } finally {
      setIssuingToken(false);
    }
  }

  async function refreshOwnerUserId() {
    setRefreshingOwner(true);
    try {
      await loadState();
    } finally {
      setRefreshingOwner(false);
    }
  }

  async function sendTestPush() {
    setPushSending(true);
    try {
      const res = await fetch('/api/store/onboarding/test-push', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success('テストメッセージを送信しました！');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'テスト送信失敗');
    } finally {
      setPushSending(false);
    }
  }

  async function completeOnboarding() {
    await fetch('/api/store/onboarding/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complete: true }),
    });
    setPhase('complete');
    setState((s) => s ? { ...s, onboardingCompletedAt: new Date().toISOString() } : s);
    toast.success('セットアップが完了しました！');
  }

  if (phase === 'loading') {
    return (
      <AdminShell title="初期セットアップ">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" strokeWidth={2} />
        </div>
      </AdminShell>
    );
  }

  if (phase === 'complete') {
    return (
      <AdminShell title="セットアップ完了">
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" strokeWidth={2} />
            <div>
              <div className="text-base font-bold text-stone-900">セットアップ完了</div>
              <div className="text-xs text-stone-600 mt-1">
                {state?.gymName} の LINE 連携・リッチメニューが有効になっています。
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
              リッチメニュー管理
            </h2>
            <div className="text-xs text-stone-600">
              ボタンのラベルを変更したり、リッチメニューを再構築できます。
            </div>
            <WarningBox>
              リッチメニューは LINE 公式アカウントマネージャーで作成・編集しないでください。LINE の優先順位仕様により FitMeal のメニューが上書き・無効化され、お客様がアプリを開けなくなります。変更はこの画面から行ってください。
            </WarningBox>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">左ボタン</label>
                <input
                  value={openLabel}
                  onChange={(e) => setOpenLabel(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">右ボタン</label>
                <input
                  value={registerLabel}
                  onChange={(e) => setRegisterLabel(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </div>
            {state?.richMenuId && (
              <div className="text-[10px] text-stone-500">
                現在の richMenuId: {state.richMenuId}
              </div>
            )}
            <button
              onClick={buildRichMenu}
              disabled={buildingMenu}
              className="w-full bg-violet-600 text-white font-bold py-2.5 rounded-xl active:bg-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${buildingMenu ? 'animate-spin' : ''}`} strokeWidth={2.2} />
              {buildingMenu ? '構築中…' : 'リッチメニューを再構築'}
            </button>
          </section>
        </div>
      </AdminShell>
    );
  }

  const tenantId = state?.tenantId ?? '';
  const liffEndpointUrl = tenantId
    ? `${APP_DOMAIN}/home?tenantId=${encodeURIComponent(tenantId)}`
    : `${APP_DOMAIN}/home`;

  return (
    <AdminShell title="初期セットアップ">
      <div className="space-y-4">
        <StepIndicator current={currentStep} />

        {/* ステップ 0: はじめに */}
        {currentStep === 0 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-stone-900">はじめに</h2>
            <p className="text-sm text-stone-700">
              このウィザードでは、LINE公式アカウントと FitMeal を連携し、お客様がアプリを使える状態にします。
            </p>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-stone-700">所要時間</div>
              <div className="text-sm text-stone-800">約 10〜15 分</div>
            </div>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-stone-700">事前に用意するもの</div>
              <ul className="text-sm text-stone-800 space-y-1 list-disc list-inside">
                <li>LINE 公式アカウントの管理権限（Messaging API が有効な状態）</li>
                <li>LINE Developers Console へのアクセス</li>
                <li>スマートフォン（動作テスト用）</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs p-3 rounded-xl">
              Messaging API がまだ有効でない場合は、LINE 公式アカウントマネージャー（manager.line.biz）の「設定 &gt; Messaging API」から有効化してください。
            </div>
            <button
              onClick={goNext}
              className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl active:bg-violet-800 inline-flex items-center justify-center gap-2"
            >
              はじめる
              <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
            </button>
          </section>
        )}

        {/* ステップ 1: LINE 連携キー */}
        {currentStep === 1 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-stone-900">STEP 1: LINE 連携キー</h2>

            <WarningBox>
              LIFF アプリは必ず <strong>公式アカウントと同じプロバイダー</strong> で作成してください。
              別プロバイダーで作成すると、動作テストや顧客登録が失敗します。
            </WarningBox>

            {/* エンドポイント URL */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-stone-700">LIFF エンドポイント URL（コピーして使用）</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs break-all">
                  {liffEndpointUrl}
                </code>
                <CopyButton value={liffEndpointUrl} />
              </div>
            </div>

            {/* LIFF ID 設定手順 */}
            <details className="border border-stone-200 rounded-xl">
              <summary className="px-3 py-2.5 text-xs font-bold text-stone-700 cursor-pointer">
                LIFF アプリの作成手順を見る
              </summary>
              <div className="px-3 pb-3 text-xs text-stone-700 space-y-1.5 border-t border-stone-100 pt-2">
                <p>1. <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-violet-700 underline inline-flex items-center gap-0.5">LINE Developers Console <ExternalLink className="w-3 h-3" /></a> を開く</p>
                <p>2. 公式アカウントと同じプロバイダーのチャンネルを選択（なければ「LINE Login チャンネル」を新規作成）</p>
                <p>3.「LIFF」タブ →「Add」</p>
                <p>4. 設定:</p>
                <ul className="list-disc list-inside pl-2 space-y-0.5">
                  <li>LIFF app name: 任意（例: FitMeal)</li>
                  <li>Size: Full</li>
                  <li>Endpoint URL: 上記の URL をコピー&貼り付け</li>
                  <li>Scope: profile, openid</li>
                  <li>Bot link feature: On (Aggressive)</li>
                </ul>
                <p>5. 作成後に表示される「LIFF ID」を下の欄に入力</p>
              </div>
            </details>

            {/* LIFF ID 入力 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 block">LIFF ID</label>
              <div className="flex gap-2">
                <input
                  value={liffIdInput}
                  onChange={(e) => setLiffIdInput(e.target.value)}
                  placeholder="1234567890-AbCdEfGh"
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <button
                  onClick={verifyLiff}
                  disabled={verifyingLiff || !liffIdInput.trim()}
                  className="bg-violet-100 text-violet-800 font-bold px-3 py-2 rounded-xl text-xs active:bg-violet-200 disabled:opacity-50 shrink-0"
                >
                  {verifyingLiff ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> : '保存'}
                </button>
              </div>
              {liffVerified && (
                <div className="text-xs text-emerald-700 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                  LIFF ID 保存済み {state?.liffId && `(${state.liffId})`}
                </div>
              )}
            </div>

            {/* Channel Token 設定手順 */}
            <details className="border border-stone-200 rounded-xl">
              <summary className="px-3 py-2.5 text-xs font-bold text-stone-700 cursor-pointer">
                長期チャネルアクセストークンの発行手順を見る
              </summary>
              <div className="px-3 pb-3 text-xs text-stone-700 space-y-1.5 border-t border-stone-100 pt-2">
                <p>1. LINE Developers Console で公式アカウントの Messaging API チャンネルを開く</p>
                <p>2.「Messaging API 設定」タブ →「チャネルアクセストークン（長期）」セクション</p>
                <p>3.「発行」ボタンを押してトークンをコピー</p>
                <p>4. 下の欄に貼り付けて「接続確認」を押す</p>
              </div>
            </details>

            {/* Channel Token 入力 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 block">チャネルアクセストークン（長期）</label>
              <textarea
                value={channelTokenInput}
                onChange={(e) => setChannelTokenInput(e.target.value)}
                placeholder="チャネルアクセストークンを貼り付け"
                rows={3}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              />
              <button
                onClick={verifyToken}
                disabled={verifyingToken || !channelTokenInput.trim()}
                className="w-full bg-violet-600 text-white font-bold py-2.5 rounded-xl active:bg-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                {verifyingToken ? (
                  <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />接続確認中…</>
                ) : '接続確認'}
              </button>
              {tokenVerifiedInfo && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl space-y-1">
                  <div className="font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                    接続成功: {tokenVerifiedInfo.botName ?? 'LINE Bot'}
                  </div>
                  {tokenVerifiedInfo.basicId && (
                    <div>LINE ID: {tokenVerifiedInfo.basicId}</div>
                  )}
                </div>
              )}
              {state?.channelTokenVerified && !tokenVerifiedInfo && (
                <div className="text-xs text-emerald-700 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                  トークン接続済み
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="flex-1 border border-stone-200 text-stone-700 font-bold py-2.5 rounded-xl active:bg-stone-100 inline-flex items-center justify-center gap-1 text-sm"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
                戻る
              </button>
              <button
                onClick={goNext}
                disabled={!liffVerified || !state?.channelTokenVerified}
                className="flex-1 bg-violet-600 text-white font-bold py-2.5 rounded-xl active:bg-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-1 text-sm"
              >
                次へ
                <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
          </section>
        )}

        {/* ステップ 2: リッチメニュー */}
        {currentStep === 2 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-stone-900">STEP 2: リッチメニュー自動構築</h2>

            <p className="text-sm text-stone-700">
              LINE のトーク画面下部に固定表示されるリッチメニューを自動で作成します。
              ボタン1つで完了します。
            </p>

            <WarningBox>
              <strong>重要:</strong> リッチメニューは LINE 公式アカウントマネージャーで作成・編集しないでください。
              LINE の優先順位仕様により FitMeal のメニューが上書き・無効化され、お客様がアプリを開けなくなります。
              変更はこの画面から行ってください。
            </WarningBox>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">左ボタンのラベル</label>
                <input
                  value={openLabel}
                  onChange={(e) => setOpenLabel(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">右ボタンのラベル</label>
                <input
                  value={registerLabel}
                  onChange={(e) => setRegisterLabel(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </div>

            {state?.richMenuId && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
                リッチメニュー構築済み（ID: {state.richMenuId.slice(0, 20)}…）
              </div>
            )}

            <button
              onClick={buildRichMenu}
              disabled={buildingMenu}
              className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl active:bg-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${buildingMenu ? 'animate-spin' : ''}`} strokeWidth={2.2} />
              {buildingMenu ? '構築中…' : state?.richMenuId ? 'リッチメニューを再構築' : 'リッチメニューを構築'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="flex-1 border border-stone-200 text-stone-700 font-bold py-2.5 rounded-xl active:bg-stone-100 inline-flex items-center justify-center gap-1 text-sm"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
                戻る
              </button>
              <button
                onClick={goNext}
                disabled={!state?.richMenuId}
                className="flex-1 bg-violet-600 text-white font-bold py-2.5 rounded-xl active:bg-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-1 text-sm"
              >
                次へ
                <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
          </section>
        )}

        {/* ステップ 3: ブランド設定 */}
        {currentStep === 3 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-stone-900">STEP 3: ブランド設定</h2>
            <p className="text-sm text-stone-700">
              現在の設定を確認してください。変更が必要な場合は後から設定画面で変更できます。
            </p>

            <div className="bg-stone-50 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-[10px] text-stone-500 font-bold mb-0.5">ジム名</div>
                <div className="text-sm font-bold text-stone-900">{state?.gymName ?? '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-stone-500 font-bold mb-0.5">LIFF ID</div>
                <div className="text-xs text-stone-700 break-all">{state?.liffId ?? '未設定'}</div>
              </div>
              <div>
                <div className="text-[10px] text-stone-500 font-bold mb-0.5">LINE Bot 接続</div>
                <div className="text-xs text-stone-700">
                  {state?.channelTokenVerified
                    ? <span className="text-emerald-700 font-bold">接続済み</span>
                    : '未接続'}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs p-3 rounded-xl">
              ジム名・テーマカラー等の詳細設定は、セットアップ完了後に設定画面から変更できます。
            </div>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="flex-1 border border-stone-200 text-stone-700 font-bold py-2.5 rounded-xl active:bg-stone-100 inline-flex items-center justify-center gap-1 text-sm"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
                戻る
              </button>
              <button
                onClick={goNext}
                className="flex-1 bg-violet-600 text-white font-bold py-2.5 rounded-xl active:bg-violet-800 inline-flex items-center justify-center gap-1 text-sm"
              >
                次へ
                <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
          </section>
        )}

        {/* ステップ 4: 動作テスト */}
        {currentStep === 4 && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-stone-900">STEP 4: 動作テスト</h2>
            <p className="text-sm text-stone-700">
              LINE のテストメッセージを送信して、連携が正しく動いていることを確認します。
            </p>

            <div className="space-y-3">
              <div className="text-xs font-bold text-stone-700">手順 1: テストリンクをスマートフォンで開く</div>
              <p className="text-xs text-stone-600">
                下のボタンでテストリンクを発行し、<strong>ご自身のスマートフォンの LINE</strong> で開いてください。
                FitMeal への LINE ユーザー ID の登録が自動的に行われます。
              </p>

              <button
                onClick={issueTestToken}
                disabled={issuingToken}
                className="w-full border border-violet-300 text-violet-700 font-bold py-2.5 rounded-xl active:bg-violet-50 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                <QrCode className={`w-4 h-4 ${issuingToken ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                {issuingToken ? '発行中…' : 'テストリンクを発行'}
              </button>

              {testUrl && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] text-stone-500 font-bold">テスト URL（LINE のトークで自分に送るか、QR コードを読み取ってください）</div>
                  <code className="text-xs text-stone-800 break-all block">{testUrl}</code>
                  <div className="flex gap-2">
                    <CopyButton value={testUrl} />
                    <a
                      href={testUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg hover:bg-violet-100"
                    >
                      <ExternalLink className="w-3 h-3" strokeWidth={2.2} />
                      開く
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-stone-700">手順 2: LINE ユーザー ID 取得を確認</div>
              <div className="flex items-center gap-2">
                <div className={`text-xs font-bold ${state?.ownerLineUserId ? 'text-emerald-700' : 'text-stone-500'}`}>
                  {state?.ownerLineUserId
                    ? `取得済み (${state.ownerLineUserId.slice(0, 12)}…)`
                    : '未取得（テストリンクを開いてください）'}
                </div>
                <button
                  onClick={refreshOwnerUserId}
                  disabled={refreshingOwner}
                  className="text-[10px] text-stone-500 border border-stone-200 px-2 py-1 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingOwner ? 'animate-spin' : ''}`} strokeWidth={2.2} />
                  更新
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-stone-700">手順 3: テストメッセージを送信</div>
              <button
                onClick={sendTestPush}
                disabled={pushSending || !state?.ownerLineUserId}
                className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl active:bg-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Send className={`w-4 h-4 ${pushSending ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                {pushSending ? '送信中…' : 'テストメッセージを送信'}
              </button>
              {!state?.ownerLineUserId && (
                <div className="text-[10px] text-stone-500 text-center">
                  ※ 手順 1 のテストリンクを開くと、このボタンが有効になります
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl">
              <div className="font-bold mb-1">送信に失敗する場合</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>LIFF と公式アカウントが別プロバイダーになっていないか確認してください</li>
                <li>公式アカウントの友だちになっていることを確認してください</li>
                <li>チャネルアクセストークンが正しいか確認してください</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="flex-1 border border-stone-200 text-stone-700 font-bold py-2.5 rounded-xl active:bg-stone-100 inline-flex items-center justify-center gap-1 text-sm"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
                戻る
              </button>
              <button
                onClick={completeOnboarding}
                className="flex-1 bg-emerald-500 text-white font-bold py-2.5 rounded-xl active:bg-emerald-700 inline-flex items-center justify-center gap-1 text-sm"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />
                セットアップ完了
              </button>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

