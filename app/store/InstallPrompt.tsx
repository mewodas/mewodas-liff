'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'fitmeal-store-install-dismissed';

export default function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setShow(false);
    setEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50 bg-violet-600 text-white rounded-2xl shadow-2xl p-3 flex items-center gap-3 max-w-md mx-auto">
      <Download className="w-5 h-5 flex-shrink-0" strokeWidth={2.2} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">FitMeal店舗をホーム画面に追加</div>
        <div className="text-[10px] opacity-90 mt-0.5">アプリのようにすぐ起動できます</div>
      </div>
      <button
        type="button"
        onClick={install}
        className="text-[11px] font-bold bg-white text-violet-700 px-3 py-1.5 rounded-full flex-shrink-0"
      >
        追加
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="text-white/80 hover:text-white p-1 flex-shrink-0"
        aria-label="閉じる"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
