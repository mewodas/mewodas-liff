'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  UtensilsCrossed,
  CheckCircle2,
  Camera,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

type Props = {
  customerName: string;
  lineUserId: string;
};

type Step = 1 | 2 | 3 | 4 | 5;
const TOTAL = 5;

export default function OnboardingFlow({ customerName, lineUserId }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [completing, setCompleting] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // ステップ2でフッターの「食事記録」ボタンをスポットライト
  useEffect(() => {
    if (step !== 2) {
      setSpotlightRect(null);
      return;
    }
    function updateRect() {
      const el = document.querySelector('[data-tour="footer-record"]');
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
      } else {
        setSpotlightRect(null);
      }
    }
    updateRect();
    const id = setTimeout(updateRect, 300);
    window.addEventListener('resize', updateRect);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', updateRect);
    };
  }, [step]);

  // ステップ3でホームの食事記録カード（朝食〜間食）をスポットライト
  useEffect(() => {
    if (step !== 3) {
      setSpotlightRect(null);
      return;
    }
    function updateRect() {
      const el = document.querySelector('[data-onboarding="meal-cards"]');
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        setSpotlightRect(null);
      }
    }
    updateRect();
    const id = setTimeout(updateRect, 400);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step]);

  async function markOnboarded(): Promise<void> {
    try {
      await apiFetch(`/api/customer/onboarding`, {
        method: 'POST',
      });
    } catch {
      // API失敗でもリダイレクトは続行
    }
  }

  async function complete() {
    if (completing) return;
    setCompleting(true);
    await markOnboarded();
    window.location.href = '/home';
  }

  function next() {
    if (step < TOTAL - 1) {
      setStep((s) => (s + 1) as Step);
    } else {
      complete();
    }
  }

  const PAD = 8;
  const spotlightStyle = spotlightRect
    ? {
        top: spotlightRect.top - PAD,
        left: spotlightRect.left - PAD,
        width: spotlightRect.width + PAD * 2,
        height: spotlightRect.height + PAD * 2,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
      }
    : null;

  const showSpotlight = (step === 2 || step === 3) && spotlightStyle;

  return (
    <div className="fixed inset-0 z-[200]" aria-modal="true">
      {/* オーバーレイ: スポットライト使用時は透明背景、それ以外は半透明 */}
      {showSpotlight ? (
        <>
          {/* スポットライト矩形（周囲を暗く、要素をくり抜く） */}
          <div
            aria-hidden
            className="absolute rounded-2xl pointer-events-none transition-all duration-300"
            style={spotlightStyle}
          />
          {/* スキップボタン */}
          <button
            type="button"
            onClick={complete}
            className="absolute top-4 right-4 z-10 text-white/80 bg-black/30 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
          >
            スキップ
          </button>
        </>
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}

      {/* ステップ別コンテンツ */}
      {step === 1 && (
        <StepWelcome name={customerName} onNext={next} onSkip={complete} />
      )}
      {step === 2 && (
        <StepFooterRecord spotlightRect={spotlightRect} onNext={next} onSkip={complete} />
      )}
      {step === 3 && (
        <StepMealCards spotlightRect={spotlightRect} onNext={next} onSkip={complete} />
      )}
      {step === 4 && (
        <StepPhotoHint onNext={next} onSkip={complete} />
      )}
      {step === 5 && (
        <StepComplete onNext={complete} completing={completing} />
      )}

      {/* ページ進捗バー（中央下部） */}
      {!showSpotlight && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i < step ? 'bg-white w-5' : 'bg-white/30 w-3'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepWelcome({ name, onNext, onSkip }: { name: string; onNext: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto">
      <div className="bg-white rounded-3xl shadow-2xl px-6 py-8 flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <UtensilsCrossed className="w-8 h-8 text-emerald-600" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900 mb-2">{name}様、ようこそ！</h1>
          <div className="text-sm text-stone-600 leading-relaxed space-y-1">
            <p>食事を写真で記録するだけで、</p>
            <p>AIが栄養バランスを自動計算します。</p>
            <p>まずは使い方をご案内します。</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 flex items-center justify-center gap-2 text-sm"
        >
          使い方を見る <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <button type="button" onClick={onSkip} className="text-xs text-stone-400 underline">
          スキップ
        </button>
      </div>
    </div>
  );
}

function StepFooterRecord({
  spotlightRect,
  onNext,
  onSkip,
}: {
  spotlightRect: DOMRect | null;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isTop = spotlightRect ? spotlightRect.top > window.innerHeight / 2 : true;
  const calloutStyle: React.CSSProperties = spotlightRect
    ? isTop
      ? {
          position: 'fixed',
          bottom: window.innerHeight - spotlightRect.top + 16,
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : {
          position: 'fixed',
          top: spotlightRect.bottom + 16,
          left: '50%',
          transform: 'translateX(-50%)',
        }
    : { position: 'fixed', bottom: '30%', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div style={calloutStyle} className="w-[88%] max-w-xs z-10">
      <div className="bg-white rounded-2xl shadow-2xl px-5 py-4">
        {/* 吹き出し矢印（下向き = フッターを指す） */}
        {spotlightRect && isTop && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-white drop-shadow-sm" />
        )}
        {spotlightRect && !isTop && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-[12px] border-l-transparent border-r-transparent border-b-white drop-shadow-sm" />
        )}
        <div className="text-sm font-bold text-stone-900 mb-1.5 flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
          ここから食事を記録します
        </div>
        <p className="text-xs text-stone-600 leading-relaxed mb-4">
          下メニューの「食事記録」をタップすると記録画面が開きます。写真・テキスト・食品DBから記録できます。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            className="flex-1 bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm active:bg-emerald-700 flex items-center justify-center gap-1"
          >
            次へ <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2.5 rounded-xl text-xs font-bold text-stone-500 bg-stone-100 active:bg-stone-200"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepMealCards({
  spotlightRect,
  onNext,
  onSkip,
}: {
  spotlightRect: DOMRect | null;
  onNext: () => void;
  onSkip: () => void;
}) {
  const calloutStyle: React.CSSProperties = spotlightRect
    ? {
        position: 'fixed',
        top: spotlightRect.top - 16,
        left: '50%',
        transform: 'translate(-50%, -100%)',
      }
    : { position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div style={calloutStyle} className="w-[88%] max-w-xs z-10">
      <div className="bg-white rounded-2xl shadow-2xl px-5 py-4">
        {spotlightRect && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-white drop-shadow-sm" />
        )}
        <div className="text-sm font-bold text-stone-900 mb-1.5 flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
          食事区分ごとに記録できます
        </div>
        <p className="text-xs text-stone-600 leading-relaxed mb-4">
          朝食・昼食・夕食・間食のカードをタップして、写真またはテキストで記録しましょう。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            className="flex-1 bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm active:bg-emerald-700 flex items-center justify-center gap-1"
          >
            次へ <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2.5 rounded-xl text-xs font-bold text-stone-500 bg-stone-100 active:bg-stone-200"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepPhotoHint({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto">
      <div className="bg-white rounded-3xl shadow-2xl px-6 py-7 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Camera className="w-5 h-5 text-sky-600" strokeWidth={2} />
          </div>
          <h2 className="text-base font-bold text-stone-900">写真で記録するには</h2>
        </div>
        <ol className="space-y-2.5">
          {[
            '「食事記録」から朝食／昼食などを選ぶ',
            'カメラアイコンをタップして写真を撮影',
            'AIが自動でカロリー・栄養素を計算',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700">
              <span className="w-5 h-5 flex-shrink-0 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {text}
            </li>
          ))}
        </ol>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800">
          写真が難しい場合はテキスト入力や食品DBからも記録できます。
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-2xl text-sm active:bg-emerald-700 flex items-center justify-center gap-1"
          >
            次へ <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-3 rounded-2xl text-xs font-bold text-stone-500 bg-stone-100 active:bg-stone-200"
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}

function StepComplete({ onNext, completing }: { onNext: () => void; completing: boolean }) {
  return (
    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto">
      <div className="bg-white rounded-3xl shadow-2xl px-6 py-8 flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">準備完了！</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            さっそく今日の食事を記録して、<br />
            目標達成を目指しましょう！
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={completing}
          className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 disabled:opacity-60 text-sm"
        >
          {completing ? 'ホームへ移動中…' : 'ホームで記録を始める'}
        </button>
      </div>
    </div>
  );
}
