'use client';

import { useEffect, useState, useRef } from 'react';
import { initLiff, getLineProfile, closeLiff } from '@/lib/liff';
import { compressImage } from '@/lib/imageCompress';

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // 同じファイルを再選択できるよう input をリセット
    if (fileInputRef.current) fileInputRef.current.value = '';

    setError(null);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setPhotos((prev) => [...prev, ...compressed].slice(0, 4));
      const newPreviews = await Promise.all(
        compressed.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('プレビュー作成失敗'));
              reader.readAsDataURL(file);
            })
        )
      );
      setPreviews((prev) => [...prev, ...newPreviews].slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : '写真の処理でエラー');
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAllPhotos() {
    setPhotos([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    if (!mealType || !userId) {
      setError('食事区分を選んでください');
      return;
    }
    if (photos.length === 0 && !comment.trim()) {
      setError('写真かメモのどちらかは入力してください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // FormDataで写真+メタ情報を送信（FileReader経由しないため安定）
      const formData = new FormData();
      formData.append('lineUserId', userId);
      formData.append('displayName', displayName);
      formData.append('day', day);
      formData.append('mealType', mealType);
      formData.append('comment', comment);
      photos.forEach((file, i) => {
        formData.append(`photo_${i}`, file, file.name);
      });

      const res = await fetch('/api/record', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        let detail: string;
        if (res.status === 413) {
          detail = '画像サイズが大きすぎます。枚数を減らすかメモのみで試してください。';
        } else if (res.status === 504 || res.status === 502) {
          detail = `処理がタイムアウトしました（${res.status}）。枚数を減らすかもう一度お試しください。`;
        } else {
          const errJson = await res.json().catch(() => null);
          detail = errJson?.error || `記録に失敗しました（${res.status}）`;
        }
        throw new Error(detail);
      }
      const json = await res.json();
      setResult(json.pfc);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('handleSubmit error:', e);
      let msg = '送信エラー';
      if (e instanceof Error) {
        msg = e.message || '送信エラー（詳細不明）';
      } else if (typeof e === 'string') {
        msg = e;
      } else if (e && typeof e === 'object' && 'message' in e) {
        msg = String((e as { message: unknown }).message);
      } else {
        msg = `送信エラー: ${String(e).slice(0, 200)}`;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPhotos([]);
    setPreviews([]);
    setMealType(null);
    setComment('');
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-md p-6 mb-4 border border-stone-200">
            <div className="text-sm font-semibold text-stone-700 mb-1">{day} の {mealType}</div>
            <div className="text-2xl font-bold mb-4 text-stone-900">✅ 記録しました</div>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="text-4xl font-bold text-stone-900">{result.kcal}</div>
              <div className="text-sm font-medium text-stone-700">kcal</div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="タンパク質" value={`${result.P} g`} />
              <Row label="脂質" value={`${result.F} g`} />
              <Row label="炭水化物" value={`${result.C} g`} />
            </div>
            {result.items && result.items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-200">
                <div className="text-xs font-semibold text-stone-700 mb-2">食材内訳</div>
                <div className="text-sm text-stone-800">
                  {result.items.map((i) => i.name).join('、')}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-sm active:bg-emerald-700">
              もう一回記録する
            </button>
            <button
              onClick={() => { void closeLiff(); }}
              className="flex-1 bg-stone-300 text-stone-900 font-bold py-3 rounded-xl active:bg-stone-400"
            >
              閉じる
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-1 text-stone-900">📷 食事記録</h1>
        <p className="text-sm font-medium text-stone-700 mb-6">{displayName ? `${displayName} さん` : ''}</p>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <div className="flex justify-between items-center mb-1">
            <div className="text-base font-bold text-stone-900">① 写真（任意）</div>
            {previews.length > 0 && (
              <button onClick={clearAllPhotos} className="text-xs text-stone-700 underline">
                全削除
              </button>
            )}
          </div>
          <p className="text-xs text-stone-600 mb-3">
            最大4枚まで。コース料理など複数皿は別々に撮影してアップしてください。
          </p>
          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`preview-${i}`} className="w-full aspect-square object-cover rounded-xl border border-stone-200" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-red-600 text-white text-xs w-6 h-6 rounded-full font-bold shadow"
                    aria-label={`写真${i + 1}を削除`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {previews.length < 4 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-stone-400 rounded-xl py-6 text-stone-800 font-semibold active:bg-stone-50"
            >
              📷 {previews.length > 0 ? '写真を追加' : '写真を選ぶ'}
              <div className="text-xs font-normal text-stone-600 mt-1">カメラ・ライブラリどちらからもOK</div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-3">② いつの食事？</div>
          <div className="flex gap-2 mb-3">
            {(['今日', '昨日'] as DayLabel[]).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold ${
                  day === d ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-700 border border-stone-300'
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
                className={`py-2 rounded-xl text-sm font-bold ${
                  mealType === m ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-700 border border-stone-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 border border-stone-200">
          <div className="text-base font-bold text-stone-900 mb-3">
            ③ メモ {photos.length > 0 ? '（任意）' : '（写真なしの場合は必須）'}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="例：ご飯茶碗1杯、鶏むね肉150g、味噌汁、サラダ"
            rows={3}
            className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!mealType || (photos.length === 0 && !comment.trim()) || submitting}
          className="w-full bg-emerald-600 text-white text-lg font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
        >
          {submitting ? '記録中…' : '記録する'}
        </button>
        {submitting && (
          <p className="text-xs text-stone-700 text-center mt-3">
            AI解析中です（5〜10秒）。画面を閉じないでお待ちください。
          </p>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-700 font-medium">{label}</span>
      <span className="font-bold text-stone-900">{value}</span>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      } catch (err) {
        reject(new Error(`画像の変換に失敗（${file.name}）: ${err instanceof Error ? err.message : String(err)}`));
      }
    };
    reader.onerror = () => reject(new Error(`画像の読み込みに失敗（${file.name}）`));
    reader.onabort = () => reject(new Error(`画像の読み込みが中断されました（${file.name}）`));
    reader.readAsDataURL(file);
  });
}
