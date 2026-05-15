'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { invalidate } from '@/lib/clientCache';
import PageHeader from '@/components/PageHeader';
import { Footprints, CheckCircle2, ClipboardList, Plus, Square } from 'lucide-react';

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

export default function ExercisePage() {
  const router = useRouter();
  const todayStr = jstTodayString();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedExercised, setSavedExercised] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingContent, setExistingContent] = useState<string>('');
  const [loadingExisting, setLoadingExisting] = useState(false);

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

  // 選択した日の既存運動記録を取得（追記方式のため）
  useEffect(() => {
    if (!userId || !date) return;
    setLoadingExisting(true);
    setExistingContent('');
    setContent('');
    fetch(`/api/today?lineUserId=${encodeURIComponent(userId)}&date=${date}&t=${Date.now()}`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const ec = j?.today?.exerciseContent || '';
        if (ec) setExistingContent(ec);
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, [userId, date]);

  async function handleSubmit() {
    if (!userId) {
      setError('LINEプロフィール未取得');
      return;
    }
    setSubmitting(true);
    setError(null);
    // テキストが入っていれば「した」、空なら「してない」
    const trimmed = content.trim();
    const exercised = trimmed.length > 0 || !!existingContent;
    // 既存の運動記録に追記（上書きしない）
    const mergedContent =
      existingContent && trimmed
        ? `${existingContent}\n${trimmed}`
        : existingContent || trimmed;
    try {
      const res = await fetch('/api/log/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          date,
          exercised,
          content: mergedContent,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `保存失敗（${res.status}）`);
      }
      setSavedExercised(exercised);
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
        <PageHeader title="運動記録" Icon={Footprints} subtitle="今日の運動内容を入力" back />
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-md p-6 mb-4 border border-stone-200 text-center">
            <Footprints className="w-12 h-12 text-amber-500 mx-auto mb-2" strokeWidth={2}/>
            <div className="text-2xl font-bold mb-2 text-stone-900 flex items-center justify-center gap-2"><CheckCircle2 className="w-7 h-7 text-emerald-500" strokeWidth={2}/>記録しました</div>
            <div className="text-sm text-stone-700 mb-1">{fmtJp(date)}</div>
            {savedExercised && content ? (
              <div className="text-sm text-stone-800 mt-2 bg-stone-50 p-3 rounded-xl whitespace-pre-wrap leading-relaxed text-left">
                {content}
              </div>
            ) : (
              <div className="text-base text-stone-600 mt-2">
                {savedExercised ? '記録あり' : '内容なしで記録'}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSuccess(false);
                setSavedExercised(false);
                setContent('');
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
      <PageHeader title="運動記録" Icon={Footprints} subtitle="今日の運動内容を入力" back />
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

        {/* 既存運動記録（追記方式の案内） */}
        {existingContent && !loadingExisting && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
            <div className="text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" strokeWidth={2.2}/>{fmtJp(date)}の既存記録</div>
            <div className="text-xs text-stone-800 bg-white rounded-lg p-2 whitespace-pre-wrap leading-relaxed">
              {existingContent}
            </div>
            <p className="text-[10px] text-stone-600 mt-2">
              ※ 新しい運動を追加すると <strong>上書きせず追記</strong> されます。
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-2">
            ② {existingContent ? '追加で記録する運動' : '運動内容'}
          </div>
          {existingContent ? (
            <div className="text-[11px] text-stone-600 mb-2 leading-relaxed">
              ※ 既存の記録は残ります。下に入力した内容が追記されます。
            </div>
          ) : (
            <div className="text-[11px] text-stone-600 mb-2 leading-relaxed">
              書いたら「した」として記録。空のまま保存すると「してない」記録になります。
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              existingContent
                ? '追加で行った運動を入力（例：夕方ヨガ30分）'
                : '例：ジョギング30分、筋トレ40分、ストレッチ15分'
            }
            rows={4}
            className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || (!!existingContent && !content.trim())}
          className="w-full bg-emerald-500 text-white text-lg font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
        >
          {submitting
            ? '保存中…'
            : existingContent
            ? content.trim()
              ? (<span className="inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" strokeWidth={2.2}/>追加で記録する</span>)
              : '追加する運動を入力してください'
            : content.trim()
            ? (<span className="inline-flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" strokeWidth={2.2}/>運動を記録する</span>)
            : (<span className="inline-flex items-center justify-center gap-1"><Square className="w-4 h-4" strokeWidth={2.2}/>運動なしで記録する</span>)}
        </button>
      </div>
    </main>
  );
}
