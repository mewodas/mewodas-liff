'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  UtensilsCrossed,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  CheckCircle2,
  BookOpen,
  Target,
} from 'lucide-react';

type Props = {
  customerName: string;
  lineUserId: string;
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const TOTAL = 6;

export default function OnboardingFlow({ customerName, lineUserId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [completing, setCompleting] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const today = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
    );
    setSelectedDate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );
  }, []);

  useEffect(() => {
    if (step === 6) {
      autoRef.current = setTimeout(() => {
        window.location.href = '/home';
      }, 1500);
    }
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, [step]);

  async function complete() {
    if (completing) return;
    setCompleting(true);
    try {
      await fetch(`/api/customer/onboarding?lineUserId=${encodeURIComponent(lineUserId)}`, {
        method: 'POST',
      });
    } catch {
      // ignore – fail-safe: proceed to home regardless
    }
    window.location.href = '/home';
  }

  function skip() {
    complete();
  }

  function next() {
    if (step < 5) {
      setStep((s) => (s + 1) as Step);
    } else if (step === 5) {
      complete();
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        {step < 6 && (
          <div className="px-5 pt-5 pb-3 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL - 1 }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < step ? 'bg-emerald-500 w-6' : 'bg-stone-200 w-4'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-stone-500">{step} / {TOTAL - 1}</span>
            <button
              type="button"
              onClick={skip}
              className="text-xs text-stone-400 underline active:text-stone-700"
            >
              スキップ
            </button>
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {step === 1 && <StepWelcome name={customerName} onNext={next} />}
          {step === 2 && <StepMenuIntro onNext={next} />}
          {step === 3 && (
            <StepRecordStart
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onNext={next}
            />
          )}
          {step === 4 && <StepPhotoUpload onNext={next} />}
          {step === 5 && <StepComplete onNext={next} />}
          {step === 6 && <StepRedirect />}
        </div>
      </div>
    </div>
  );
}

function StepWelcome({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <div className="px-6 py-8 flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
        <UtensilsCrossed className="w-9 h-9 text-emerald-600" strokeWidth={2} />
      </div>
      <div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">
          {name}様、ようこそ！
        </h1>
        <div className="text-sm text-stone-600 leading-relaxed space-y-1.5">
          <p>食事を写真で記録するだけで、</p>
          <p>AIが栄養バランスを自動計算します。</p>
          <p>トレーナーがあなたの目標に合わせて</p>
          <p>食事アドバイスをお届けします。</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 flex items-center justify-center gap-2 text-sm"
      >
        次へ <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function StepMenuIntro({ onNext }: { onNext: () => void }) {
  const items = [
    { icon: '🏠', label: 'ホーム', desc: '今日の栄養サマリーを確認' },
    { icon: '📷', label: '食事記録', desc: '写真・テキストで記録' },
    { icon: '💬', label: 'AI相談', desc: 'AI食事アドバイス' },
    { icon: '📋', label: 'メニュー', desc: '履歴・レポートなど' },
  ];
  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <div className="text-center">
        <BookOpen className="w-10 h-10 text-emerald-600 mx-auto mb-3" strokeWidth={1.8} />
        <h2 className="text-lg font-bold text-stone-900 mb-1">メニューの使い方</h2>
        <p className="text-sm text-stone-600">画面下のメニューからすべての機能にアクセスできます</p>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3"
          >
            <span className="text-2xl w-8 text-center">{it.icon}</span>
            <div>
              <div className="text-sm font-bold text-stone-900">{it.label}</div>
              <div className="text-xs text-stone-500">{it.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800">
        まずは「食事記録」から食事を記録してみましょう
      </div>
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 flex items-center justify-center gap-2 text-sm"
      >
        次へ <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function StepRecordStart({
  selectedDate,
  onDateChange,
  onNext,
}: {
  selectedDate: string;
  onDateChange: (d: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-stone-900 mb-1">記録する日付を選んでください</h2>
        <p className="text-sm text-stone-600">通常は今日の日付でOKです</p>
      </div>
      <div>
        <label className="block text-xs font-bold text-stone-700 mb-1.5">日付</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>
      <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-xs text-sky-800 leading-relaxed">
        日付は後から変更できます。食事を記録した日を選んでください。
      </div>
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 flex items-center justify-center gap-2 text-sm"
      >
        次へ <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function StepPhotoUpload({ onNext }: { onNext: () => void }) {
  const meals = [
    { icon: Sunrise, label: '朝食', color: 'text-orange-500 bg-orange-50 border-orange-200' },
    { icon: Sun, label: '昼食', color: 'text-amber-500 bg-amber-50 border-amber-200' },
    { icon: Moon, label: '夕食', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
    { icon: Cookie, label: '間食', color: 'text-pink-500 bg-pink-50 border-pink-200' },
  ];
  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-stone-900 mb-1">写真をアップロードしよう</h2>
        <p className="text-sm text-stone-600">食事区分ごとに写真を記録できます</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {meals.map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className={`flex flex-col items-center gap-2 border rounded-2xl py-4 px-3 ${color}`}
          >
            <Icon className="w-7 h-7" strokeWidth={1.8} />
            <span className="text-sm font-bold text-stone-900">{label}</span>
            <span className="text-[10px] text-stone-500 text-center leading-tight">写真またはテキストで記録</span>
          </div>
        ))}
      </div>
      <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-700 leading-relaxed">
        食事記録ページの各ボタンをタップすると写真アップロード画面が開きます。AIが自動でカロリー・栄養素を計算します。
      </div>
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 flex items-center justify-center gap-2 text-sm"
      >
        次へ <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function StepComplete({ onNext }: { onNext: () => void }) {
  return (
    <div className="px-6 py-8 flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" strokeWidth={1.8} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">設定完了！</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          これでアプリの準備が整いました。<br />
          毎日の食事を記録して、<br />目標達成を目指しましょう！
        </p>
      </div>
      <div className="w-full space-y-2">
        <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-left">
          <Target className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2} />
          <div>
            <div className="text-xs font-bold text-stone-900">目標</div>
            <div className="text-xs text-stone-500">「目標」メニューで体重目標を確認できます</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-left">
          <UtensilsCrossed className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2} />
          <div>
            <div className="text-xs font-bold text-stone-900">食事記録</div>
            <div className="text-xs text-stone-500">下の「食事記録」から毎食記録しましょう</div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl active:bg-emerald-700 text-sm"
      >
        ホームへ進む
      </button>
    </div>
  );
}

function StepRedirect() {
  return (
    <div className="px-6 py-12 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" strokeWidth={1.8} />
      </div>
      <p className="text-sm font-bold text-stone-700">ホームへ移動中…</p>
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
