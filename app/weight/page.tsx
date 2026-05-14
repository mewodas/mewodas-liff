'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { invalidate } from '@/lib/clientCache';
import PageHeader from '@/components/PageHeader';
import { Scale, CheckCircle2 } from 'lucide-react';

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fmtJp(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${dayNames[date.getDay()]}）`;
}

export default function WeightPage() {
  const router = useRouter();
  const todayStr = jstTodayString();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [weight, setWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function handleSubmit() {
    if (!userId) {
      setError('LINEプロフィール未取得');
      return;
    }
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 300) {
      setError('体重を 0〜300 の数値で入力してください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/log/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: userId, date, weight: w }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `保存失敗（${res.status}）`);
      }
      setSuccess(true);
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-stone-100 pb-28">
        <PageHeader title="体重記録" Icon={Scale} back />
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-md p-6 mb-4 border border-stone-200 text-center">
            <Scale className="w-12 h-12 text-sky-500 mx-auto mb-2" strokeWidth={2}/>
            <div className="text-2xl font-bold mb-2 text-stone-900 flex items-center justify-center gap-2"><CheckCircle2 className="w-7 h-7 text-emerald-500" strokeWidth={2}/>記録しました</div>
            <div className="text-sm text-stone-700 mb-1">{fmtJp(date)}</div>
            <div className="text-3xl font-bold text-stone-900">{weight} <span className="text-sm text-stone-500">kg</span></div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSuccess(false);
                setWeight('');
              }}
              className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700"
            >
              もう一回記録する
            </button>
            <button
              onClick={() => router.push('/home')}
              className="flex-1 bg-stone-300 text-stone-900 font-bold py-3 rounded-xl active:bg-stone-400"
            >
              ホームへ
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="体重記録" Icon={Scale} back />
      <div className="max-w-md mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-3">① 日付</div>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-stone-50 text-stone-900 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-3">② 体重（kg）</div>
          <input
            type="number"
            step="0.1"
            min="0"
            max="300"
            inputMode="decimal"
            placeholder="例：62.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-4 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-stone-600 mt-2">毎朝起床後・食事前の測定を推奨</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!weight || submitting}
          className="w-full bg-emerald-500 text-white text-lg font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
        >
          {submitting ? '保存中…' : '記録する'}
        </button>
      </div>
    </main>
  );
}
