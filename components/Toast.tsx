'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * store / admin 全ページ共通の完了トースト。
 *
 * 保存・更新・削除などの操作が成功したら画面下部に緑のバーを出す。
 * Sansan ヘルプセンターの保存通知と同じ挙動（下から出て一定時間で自動的に消える）。
 *
 * Provider は app/admin/layout.tsx と app/store/layout.tsx でマウントしており、
 * ページ遷移してもアンマウントされない（= 保存→一覧へ遷移してもトーストが残る）。
 */

type ToastVariant = 'success' | 'error';
type ToastState = { id: number; message: string; variant: ToastVariant };

export type ToastApi = {
  /** 緑のトースト。保存・更新・削除などの完了時に使う。 */
  success: (message: string) => void;
  /** 赤のトースト。操作失敗時に使う。 */
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** 自動的に消えるまでの時間（ミリ秒）。 */
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const show = useCallback((message: string, variant: ToastVariant) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message, variant });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setToast(null);
    }, AUTO_DISMISS_MS);
  }, []);

  // アンマウント時にタイマーを掃除する。
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        // key を toast.id にすることで、新しいトーストのたびに再マウントされ
        // スライドインのアニメーションが毎回再生される。
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`fitmeal-toast fixed inset-x-0 bottom-0 z-[60] ${
            toast.variant === 'error' ? 'bg-rose-600' : 'bg-[#4caf50]'
          }`}
        >
          <div className="px-4 sm:px-6 py-3.5 flex items-center gap-5">
            <span className="text-sm font-medium text-white">{toast.message}</span>
            <button
              type="button"
              onClick={dismiss}
              className="text-sm font-bold text-white/90 hover:text-white shrink-0"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fitmeal-toast-in {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .fitmeal-toast {
          animation: fitmeal-toast-in 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </ToastContext.Provider>
  );
}

/**
 * 完了トーストを出すためのフック。
 *
 *   const toast = useToast();
 *   toast.success('保存しました');
 *   toast.error('保存に失敗しました');
 *
 * Provider の外で呼ばれても落ちないよう、その場合は no-op を返す。
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('useToast() は <ToastProvider> の外で呼ばれています。');
    }
    return { success: () => {}, error: () => {} };
  }
  return ctx;
}
