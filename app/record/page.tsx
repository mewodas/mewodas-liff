'use client';

import { useEffect, useState, useRef } from 'react';
import { initLiff, getLineProfile, closeLiff } from '@/lib/liff';

type MealType = '朝食' | '昼食' | '間食' | '夕食';
type DayLabel = '今日' | '昨日';

type RecordResult = {
  kcal: number;
  P: number;
  F: number;
  C: number;
  items?: Array<{ name: string; P: number; F: number; C: number }>;
};

export default function RecordPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [day, setDay] = useState<DayLabel>('今日');
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) {
          setUserId(profile.userId);
          setDisplayName(profile.displayName);
        }
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化失敗');
        setReady(true);
      }
    })();
  }, []);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!photo || !mealType || !userId) {
      setError('写真と食事区分を選んでください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const photoBase64 = await fileToBase64(photo);
      const res = await fetch('/api/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          displayName,
          day,
          mealType,
          comment,
          photoBase64,
          mimeType: photo.type,
        }),
      });
      if (!res.ok) throw new Error('記録に失敗しました（' + res.status + '）');
      const json = await res.json();
      setResult(json.pfc);
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPhoto(null);
    setPreview(null);
    setMealType(null);
    setComment('');
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">読み込み中...</div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow p-6 mb-4">
            <div className="text-sm text-stone-500 mb-1">{day} の {mealType}</div>
            <div className="text-2xl font-bold mb-4">✅ 記録しました</div>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="text-4xl font-bold">{result.kcal}</div>
              <div className="text-sm text-stone-500">kcal</div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="タンパク質" value={`${result.P} g`} />
              <Row label="脂質" value={`${result.F} g`} />
              <Row label="炭水化物" value={`${result.C} g`} />
            </div>
            {result.items && result.items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="text-xs text-stone-500 mb-2">食材内訳</div>
                <div className="text-sm text-stone-700">
                  {result.items.map((i) => i.name).join('、')}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl">
              もう一回記録する
            </button>
            <button onClick={closeLiff} className="flex-1 bg-stone-200 text-stone-700 font-semibold py-3 rounded-xl">
              閉じる
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-1">📷 食事記録</h1>
        <p className="text-sm text-stone-500 mb-6">{displayName ? `${displayName} さん` : ''}</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow p-5 mb-4">
          <div className="text-sm font-semibold mb-2">① 写真</div>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="preview" className="w-full rounded-xl mb-2" />
              <button onClick={() => fileInputRef.current?.click()} className="text-sm text-emerald-600">
                写真を変更
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-stone-300 rounded-xl py-8 text-stone-500"
            >
              📷 写真を選ぶ
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-4">
          <div className="text-sm font-semibold mb-2">② いつの食事？</div>
          <div className="flex gap-2 mb-3">
            {(['今日', '昨日'] as DayLabel[]).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                  day === d ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['朝食', '昼食', '夕食', '間食'] as MealType[]).map((m) => (
              <button
                key={m}
                onClick={() => setMealType(m)}
                className={`py-2 rounded-xl text-sm font-medium ${
                  mealType === m ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <div className="text-sm font-semibold mb-2">③ メモ（任意）</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="例：ご飯茶碗1杯、鶏むね肉150g"
            rows={3}
            className="w-full bg-stone-50 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!photo || !mealType || submitting}
          className="w-full bg-emerald-600 text-white font-semibold py-4 rounded-xl shadow disabled:bg-stone-300"
        >
          {submitting ? '記録中...' : '記録する'}
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // remove "data:image/jpeg;base64," prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
