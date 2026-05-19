'use client';

import { useEffect, useState } from 'react';

export type TourStep = {
  /** ハイライトする要素の data-tour 属性値（一致したら表示） */
  target: string;
  title: string;
  description: string;
  /** ツールチップを target の上に出すか下に出すか（auto = 画面下半分なら上、上半分なら下） */
  placement?: 'top' | 'bottom' | 'auto';
};

type Props = {
  /** localStorage キー（ユーザーごと/バージョンごとに切り替え用） */
  storageKey: string;
  steps: TourStep[];
  /** 強制表示（デバッグ用、storageKeyを無視） */
  force?: boolean;
  /** すべてのステップ完了 or スキップ時に呼ばれる */
  onComplete?: () => void;
  /** 管理画面からリセットされた日時（ISO8601）。localStorageの完了日時より新しければ再表示 */
  tourResetAt?: string | null;
};

export default function OnboardingTour({ storageKey, steps, force, onComplete, tourResetAt }: Props) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // 初回マウント：未表示なら起動
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (force) {
      setActive(true);
      return;
    }
    // tourResetAt=undefined はAPIロード前の初期状態 → まだ判断しない
    if (tourResetAt === undefined) return;
    const stored = window.localStorage.getItem(storageKey);
    // Notion DB の「ツアーリセット日時」列が日付のみ (YYYY-MM-DD) で返るケースに対応:
    // その日の終わり (23:59:59.999Z) として扱い、当日中に完了した stored より新しいと判定
    const normalizedReset = tourResetAt && tourResetAt.length === 10
      ? `${tourResetAt}T23:59:59.999Z`
      : tourResetAt;
    // stored が null → 未表示 → 表示する
    // stored がある場合: tourResetAt が null(リセット未設定) → 表示済みとみなす
    //                   tourResetAt が ISO文字列 → stored >= normalizedReset なら表示済み
    const isDone = stored !== null && (
      normalizedReset === null || stored >= normalizedReset
    );
    if (!isDone) {
      // 描画完了を少し待ってから表示
      const id = setTimeout(() => setActive(true), 400);
      return () => clearTimeout(id);
    }
  }, [storageKey, force, tourResetAt]);

  // ターゲット要素の位置を取得
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;
    const update = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
        // 表示位置までスクロール
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        setRect(null);
      }
    };
    update();
    // スクロール後の位置再取得
    const id = setTimeout(update, 350);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, stepIdx, steps]);

  function finish() {
    setActive(false);
    if (!force) {
      try {
        window.localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        // ignore
      }
    }
    if (onComplete) onComplete();
  }

  function next() {
    if (stepIdx + 1 >= steps.length) {
      finish();
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  if (!active) return null;
  const step = steps[stepIdx];
  if (!step) return null;

  // ツールチップ配置：ターゲットの上 or 下（画面位置で自動判定）
  const placement: 'top' | 'bottom' =
    step.placement && step.placement !== 'auto'
      ? step.placement
      : rect && rect.top > window.innerHeight / 2
      ? 'top'
      : 'bottom';

  // スポットライト矩形（少しマージンを足して見やすく）
  const PAD = 6;
  const spotlightStyle = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // ツールチップ位置（targetの上/下）
  const TOOLTIP_GAP = 16;
  const tooltipStyle: React.CSSProperties = rect
    ? placement === 'top'
      ? {
          top: rect.top - TOOLTIP_GAP,
          left: '50%',
          transform: 'translate(-50%, -100%)',
        }
      : {
          top: rect.bottom + TOOLTIP_GAP + 32, // 矢印分の余白
          left: '50%',
          transform: 'translateX(-50%)',
        }
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };

  // 矢印位置（targetを指す）
  const arrowStyle: React.CSSProperties = rect
    ? placement === 'top'
      ? {
          // ターゲット直上、下向き矢印
          top: rect.top - 28,
          left: rect.left + rect.width / 2 - 12,
        }
      : {
          // ターゲット直下、上向き矢印
          top: rect.bottom + 4,
          left: rect.left + rect.width / 2 - 12,
        }
    : { display: 'none' };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* スポットライト（box-shadowで周囲を暗く） */}
      {spotlightStyle && (
        <div
          aria-hidden
          className="absolute rounded-xl pointer-events-none"
          style={{
            ...spotlightStyle,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            transition: 'all 0.25s ease-out',
          }}
        />
      )}
      {/* 全面暗いオーバーレイ（rectがない時用） */}
      {!spotlightStyle && (
        <div className="absolute inset-0 bg-black/65 pointer-events-auto" onClick={finish} />
      )}

      {/* 矢印（ピコピコ） */}
      {rect && (
        <div className="absolute pointer-events-none animate-bounce" style={arrowStyle}>
          <svg viewBox="0 0 24 24" width="24" height="24" className="drop-shadow-lg">
            {placement === 'top' ? (
              <path d="M12 20l-7-8h4V4h6v8h4l-7 8z" fill="#fbbf24" stroke="white" strokeWidth="1" />
            ) : (
              <path d="M12 4l7 8h-4v8h-6v-8H5l7-8z" fill="#fbbf24" stroke="white" strokeWidth="1" />
            )}
          </svg>
        </div>
      )}

      {/* ツールチップ */}
      <div
        className="absolute pointer-events-auto bg-white rounded-2xl shadow-2xl p-4 w-[88%] max-w-xs"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-full px-2 py-0.5">
            {stepIdx + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-[11px] text-stone-500 active:text-stone-800 underline"
          >
            スキップ
          </button>
        </div>
        <div className="text-sm font-bold text-stone-900 mb-1">{step.title}</div>
        <p className="text-[12px] text-stone-700 leading-relaxed mb-3">{step.description}</p>
        <div className="flex gap-2">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => setStepIdx((i) => i - 1)}
              className="flex-1 bg-stone-100 text-stone-700 text-xs font-bold py-2 rounded-xl active:bg-stone-200"
            >
              ← 戻る
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl active:bg-emerald-700"
          >
            {stepIdx + 1 === steps.length ? '始める' : '次へ →'}
          </button>
        </div>
      </div>
    </div>
  );
}
