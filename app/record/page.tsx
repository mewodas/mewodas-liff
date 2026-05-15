'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { compressImage } from '@/lib/imageCompress';
import { invalidate } from '@/lib/clientCache';
import { useDraggableSheet } from '@/lib/useDraggableSheet';
import PageHeader from '@/components/PageHeader';
import {
  Camera,
  Image as ImageIcon,
  Star,
  Search,
  ScanText,
  FileText,
  UtensilsCrossed,
  ClipboardCheck,
  Sparkles,
  Ban,
  Calendar as CalendarIcon,
  CheckCircle2,
  BarChart3,
  Lightbulb,
  Save,
} from 'lucide-react';

type MealType = '朝食' | '昼食' | '間食' | '夕食';
type DayLabel = '今日' | '昨日';

type AnalyzedItem = {
  index: number;
  name: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
};

type Stage = 'hub' | 'memo' | 'analyzing' | 'saving' | 'review' | 'saved';

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysStr(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatJpDateLabel(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${String(m).padStart(2, '0')}月${String(d).padStart(2, '0')}日（${wd}）`;
}

function guessMeal(): MealType {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours();
  if (h < 10) return '朝食';
  if (h < 15) return '昼食';
  if (h < 17) return '間食';
  return '夕食';
}

export default function RecordPage() {
  const router = useRouter();
  const todayStr = jstTodayString();
  const yesterdayStr = addDaysStr(todayStr, -1);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [mealType, setMealType] = useState<MealType>(guessMeal());
  const [comment, setComment] = useState('');
  const [stage, setStage] = useState<Stage>('hub');
  const [analyzed, setAnalyzed] = useState<AnalyzedItem[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<AnalyzedItem | null>(null);
  const [reanalyzeText, setReanalyzeText] = useState('');
  const [savedTotal, setSavedTotal] = useState<{ kcal: number; P: number; F: number; C: number } | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [labelResult, setLabelResult] = useState<{
    name: string;
    servingLabel: string;
    servings: number;
    perServing: { kcal: number; P: number; F: number; C: number };
    note: string;
  } | null>(null);
  const [labelBusy, setLabelBusy] = useState(false);

  // 食事記録が完了したらオンボの段階を進める
  useEffect(() => {
    if (stage === 'saved' && typeof window !== 'undefined') {
      try {
        const current = window.localStorage.getItem('mewodas_onboarding_step');
        if (current !== 'completed') {
          window.localStorage.setItem('mewodas_onboarding_step', 'meal_done');
        }
      } catch {
        // ignore
      }
    }
  }, [stage]);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
        // クエリパラメータからメモ画面を直接開く（?memo=1）
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('memo') === '1') setStage('memo');
          const mealParam = params.get('meal');
          if (mealParam && (['朝食', '昼食', '夕食', '間食'] as string[]).includes(mealParam)) {
            setMealType(mealParam as MealType);
          }
          const dateParam = params.get('date');
          if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            setTargetDate(dateParam);
          } else {
            const dayParam = params.get('day');
            if (dayParam === '昨日') setTargetDate(addDaysStr(todayStr, -1));
          }
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
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setError(null);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      const newPhotos = [...photos, ...compressed].slice(0, 4);
      setPhotos(newPhotos);
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
      // 自動解析は行わず、下部の「✨ 解析する」ボタンで明示的にトリガー
    } catch (err) {
      setError(err instanceof Error ? err.message : '写真の処理でエラー');
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleLabelPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (labelInputRef.current) labelInputRef.current.value = '';
    setError(null);
    setLabelBusy(true);
    setStage('analyzing');
    try {
      const compressed = await Promise.all(files.slice(0, 2).map((f) => compressImage(f)));
      const form = new FormData();
      compressed.forEach((c) => form.append('photo', c));
      const res = await fetch('/api/record/nutrition-label', { method: 'POST', body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `成分表解析失敗（${res.status}）`);
      }
      const json = await res.json();
      setLabelResult(json.result);
      setStage('hub');
    } catch (err) {
      setError(err instanceof Error ? err.message : '成分表解析エラー');
      setStage('hub');
    } finally {
      setLabelBusy(false);
    }
  }

  async function saveLabel(
    quantity: number,
    edited?: {
      name: string;
      perServing: { kcal: number; P: number; F: number; C: number };
    }
  ) {
    if (!userId || !labelResult) return;
    setLabelBusy(true);
    setError(null);
    try {
      const name = edited?.name || labelResult.name;
      const k = edited?.perServing || labelResult.perServing;
      const res = await fetch('/api/record/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          mealType,
          date: targetDate,
          title: `${name}（${quantity}× ${labelResult.servingLabel}）`,
          kcal: Math.round(k.kcal * quantity),
          P: Math.round(k.P * quantity * 10) / 10,
          F: Math.round(k.F * quantity * 10) / 10,
          C: Math.round(k.C * quantity * 10) / 10,
          source: 'nutrition_label',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      setSavedTotal({
        kcal: Math.round(k.kcal * quantity),
        P: Math.round(k.P * quantity * 10) / 10,
        F: Math.round(k.F * quantity * 10) / 10,
        C: Math.round(k.C * quantity * 10) / 10,
      });
      setLabelResult(null);
      setStage('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存エラー');
    } finally {
      setLabelBusy(false);
    }
  }

  async function runAnalyze(
    photoList: File[],
    memo: string,
    previousItems?: Array<{ name: string; P: number; F: number; C: number }>
  ) {
    if (!userId) return;
    if (photoList.length === 0 && !memo.trim()) {
      setError('写真かメモが必要です');
      return;
    }
    setError(null);
    setStage('analyzing');
    try {
      const formData = new FormData();
      formData.append('lineUserId', userId);
      formData.append('comment', memo);
      if (previousItems && previousItems.length > 0) {
        formData.append('previousItems', JSON.stringify(previousItems));
      }
      photoList.forEach((file, i) => {
        formData.append(`photo_${i}`, file, file.name);
      });
      const res = await fetch('/api/record/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `解析に失敗（${res.status}）`);
      }
      const json = await res.json();
      setAnalyzed(json.items || []);
      setExcluded(new Set());
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析エラー');
      setStage('hub');
    }
  }

  async function handleConfirm() {
    if (!userId) return;
    const selected = analyzed.filter((it) => !excluded.has(it.index));
    if (selected.length === 0) {
      setError('1つ以上の食材にチェックを入れてください');
      return;
    }
    setError(null);
    setStage('saving');
    try {
      const formData = new FormData();
      formData.append('lineUserId', userId);
      formData.append('date', targetDate);
      formData.append('mealType', mealType);
      formData.append('comment', comment);
      formData.append('items', JSON.stringify(selected));
      photos.forEach((file, i) => {
        formData.append(`photo_${i}`, file, file.name);
      });
      const res = await fetch('/api/record/confirm', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `保存失敗（${res.status}）`);
      }
      const json = await res.json();
      setSavedTotal(json.pfc);
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      invalidate('suggest_');
      setStage('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存エラー');
      setStage('review');
    }
  }

  async function handleSkip() {
    if (!userId || skipping) return;
    const label =
      targetDate === todayStr
        ? '今日'
        : targetDate === yesterdayStr
        ? '昨日'
        : formatJpDateLabel(targetDate);
    const ok = window.confirm(`${label}の${mealType}を「食べなかった」として記録しますか？`);
    if (!ok) return;
    setSkipping(true);
    setError(null);
    try {
      const res = await fetch('/api/record/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: userId, mealType, date: targetDate }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `記録失敗（${res.status}）`);
      }
      const json = await res.json();
      setSavedTotal(json.pfc);
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      setStage('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setSkipping(false);
    }
  }

  function reset() {
    setPhotos([]);
    setPreviews([]);
    setComment('');
    setAnalyzed([]);
    setExcluded(new Set());
    setSavedTotal(null);
    setError(null);
    setStage('hub');
  }

  function toggleItem(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function updateItem(idx: number, patch: Partial<Omit<AnalyzedItem, 'index'>>) {
    setAnalyzed((prev) =>
      prev.map((it) => {
        if (it.index !== idx) return it;
        const merged = { ...it, ...patch };
        // PFC が更新されたら kcal を自動計算（Atwater 4/9/4）
        if (
          patch.P !== undefined ||
          patch.F !== undefined ||
          patch.C !== undefined
        ) {
          merged.kcal = Math.round(merged.P * 4 + merged.F * 9 + merged.C * 4);
        }
        return merged;
      })
    );
  }

  async function reanalyzeWithText() {
    const txt = reanalyzeText.trim();
    if (!txt) return;
    // 既存メモ + 補正テキストを結合して再解析
    const combinedMemo = (comment ? comment + '\n' : '') + '【AI解析の補正】' + txt;
    // 補正対象以外を変えないよう、現在のアイテムをアンカーとして渡す
    const anchor = analyzed
      .filter((it) => !excluded.has(it.index))
      .map((it) => ({ name: it.name, P: it.P, F: it.F, C: it.C }));
    setReanalyzeText('');
    await runAnalyze(photos, combinedMemo, anchor);
  }

  // 表示用ラベル：targetDate が「今日/昨日/それ以外」
  const dayLabel =
    targetDate === todayStr
      ? '今日'
      : targetDate === yesterdayStr
      ? '昨日'
      : formatJpDateLabel(targetDate);

  const selectedTotal = analyzed
    .filter((it) => !excluded.has(it.index))
    .reduce(
      (acc, it) => ({
        kcal: acc.kcal + it.kcal,
        P: acc.P + it.P,
        F: acc.F + it.F,
        C: acc.C + it.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  // ===== 解析中 / 記録中 =====
  if (stage === 'analyzing' || stage === 'saving') {
    const isSaving = stage === 'saving';
    return (
      <main className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 px-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="mb-4 flex items-center justify-center">
            {isSaving ? (
              <Save className="w-8 h-8 text-emerald-600" strokeWidth={2} />
            ) : (
              <Camera className="w-8 h-8 text-emerald-600" strokeWidth={2} />
            )}
          </div>
          <h2 className="text-base font-bold text-stone-900 mb-2">
            {isSaving ? '記録してます' : '解析中'}
          </h2>
          <p className="text-xs text-stone-600 mb-6">
            {isSaving
              ? '食事データを保存しています'
              : '料理を識別してカロリー・PFCを推定しています'}
          </p>
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mx-1" />
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mx-1" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mx-1" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-[10px] text-stone-500 mt-6">
            {isSaving ? '数秒で完了します' : '約10〜15秒'}
          </p>
        </div>
      </main>
    );
  }

  // ===== 確認画面 =====
  if (stage === 'review') {
    return (
      <main className="min-h-screen bg-stone-50 pb-44">
        <PageHeader title="解析結果の確認" Icon={ClipboardCheck} subtitle="AIの推定値を確認・修正" onBack={() => setStage('hub')} />

        <div className="px-4 py-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {previews.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt={`p-${i}`} className="w-full aspect-square object-cover rounded-xl" />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 mb-4">
            <div className="text-xs text-stone-600 mb-1">{dayLabel}の{mealType}</div>
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-2xl font-bold text-stone-900">
                合計 {selectedTotal.kcal} <span className="text-sm font-normal">kcal</span>
              </div>
              <div className="text-[11px] text-stone-600">
                {analyzed.length - excluded.size} / {analyzed.length} 品
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <NutRow label="P (g)" value={Math.round(selectedTotal.P * 10) / 10} />
              <NutRow label="F (g)" value={Math.round(selectedTotal.F * 10) / 10} />
              <NutRow label="C (g)" value={Math.round(selectedTotal.C * 10) / 10} />
            </div>
          </div>

          <h2 className="text-sm font-bold text-stone-800 mb-2 px-1">
            <span className="inline-flex items-center gap-1">
              <UtensilsCrossed className="w-3.5 h-3.5 text-stone-700" strokeWidth={2.2} />
              識別された食材（左でON/OFF・右で編集）
            </span>
          </h2>
          <div className="space-y-2">
            {analyzed.map((item) => {
              const isExcluded = excluded.has(item.index);
              return (
                <div
                  key={item.index}
                  className={`w-full flex items-center bg-white border rounded-xl px-3 py-3 ${
                    isExcluded ? 'border-stone-200 opacity-50' : 'border-emerald-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(item.index)}
                    className="flex items-center flex-1 min-w-0 active:opacity-70"
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0 ${
                      isExcluded ? 'bg-stone-300' : 'bg-emerald-500'
                    }`}>
                      {isExcluded ? '' : '✓'}
                    </div>
                    <div className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold flex items-center justify-center mr-3 flex-shrink-0">
                      {item.index}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className={`text-sm font-bold truncate ${isExcluded ? 'text-stone-500 line-through' : 'text-stone-900'}`}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-stone-600 mt-0.5">
                        P{item.P}・F{item.F}・C{item.C}g
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <div className={`text-sm font-bold ${isExcluded ? 'text-stone-400' : 'text-stone-900'}`}>
                        {item.kcal}
                      </div>
                      <div className="text-[10px] text-stone-500">kcal</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="ml-2 text-[11px] font-bold text-emerald-700 border border-emerald-600 px-2.5 py-1 rounded-full active:bg-emerald-50 flex-shrink-0"
                  >
                    編集
                  </button>
                </div>
              );
            })}
          </div>

          {/* AI再解析（補正テキスト） */}
          <div className="mt-5 bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-sm font-bold text-stone-800 mb-1">🔄 AIに補正させる</div>
            <p className="text-[11px] text-stone-600 mb-2 leading-relaxed">
              アイテム名の取り違えを修正する用途です（例：「3番は明太子じゃなくて鮭フレーク」）。<br />
              <span className="text-stone-500">PFC・グラム数の細かい調整は各アイテムの「編集」ボタンが正確です。</span>
            </p>
            <textarea
              value={reanalyzeText}
              onChange={(e) => setReanalyzeText(e.target.value)}
              placeholder="例：3番は明太子じゃなくて鮭フレーク"
              rows={2}
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={reanalyzeWithText}
              disabled={!reanalyzeText.trim()}
              className="w-full mt-2 bg-white border border-emerald-500 text-emerald-700 font-bold py-2.5 rounded-xl active:bg-emerald-50 disabled:opacity-50"
            >
              🔄 補正して再解析する
            </button>
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-stone-200 p-3 shadow-lg z-40">
          <div className="max-w-md mx-auto flex gap-2">
            <button onClick={() => setStage('hub')} className="px-4 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl">
              戻る
            </button>
            <button
              onClick={handleConfirm}
              disabled={analyzed.length === excluded.size}
              className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300"
            >
              確定する（{selectedTotal.kcal} kcal）
            </button>
          </div>
        </div>

        {editingItem && (
          <EditAnalyzedSheet
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={(patch) => {
              updateItem(editingItem.index, patch);
              setEditingItem(null);
            }}
          />
        )}
      </main>
    );
  }

  // ===== 保存完了 =====
  if (stage === 'saved' && savedTotal) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6 pb-28">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-md p-6 mb-4 border border-stone-200">
            <div className="text-sm font-semibold text-stone-700 mb-1">{dayLabel} の {mealType}</div>
            <div className="text-2xl font-bold mb-4 text-stone-900 flex items-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" strokeWidth={2} />
              記録しました
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="text-4xl font-bold text-stone-900">{savedTotal.kcal}</div>
              <div className="text-sm font-medium text-stone-700">kcal</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <NutRow label="P (g)" value={savedTotal.P} />
              <NutRow label="F (g)" value={savedTotal.F} />
              <NutRow label="C (g)" value={savedTotal.C} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 bg-white border border-stone-300 text-stone-900 font-bold py-3 rounded-xl active:bg-stone-50">
              もう一回記録する
            </button>
            <a
              href="/home"
              className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl text-center active:bg-emerald-700"
            >
              ホームへ
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ===== メモ入力サブ画面 =====
  if (stage === 'memo') {
    return (
      <main className="min-h-screen bg-stone-50 pb-28">
        <PageHeader title="テキストで記録" Icon={FileText} subtitle="食べた内容を文字で入力してAI判定" onBack={() => setStage('hub')} />

        <div className="px-4 py-4 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-xl">{error}</div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
            <p className="text-xs text-stone-600 mb-3">
              食材名と分量を入力するとAIが栄養素を推定します。
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例：ご飯茶碗1杯、鶏むね150g、味噌汁"
              rows={5}
              autoFocus
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => runAnalyze([], comment)}
            disabled={!comment.trim()}
            className="w-full bg-emerald-500 text-white text-base font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" strokeWidth={2} />
            解析する
          </button>
        </div>
      </main>
    );
  }

  // ===== ハブ画面（メイン） =====
  return (
    <main className="min-h-screen bg-stone-50 pb-32">
      <PageHeader title="食事を記録" Icon={UtensilsCrossed} subtitle="写真・テキスト・成分表でPFC自動計算" onBack={() => router.push('/home')} />

      <div className="px-4 py-5">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* 大きな日付・食事区分セレクタ */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-5 border border-stone-200">
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTargetDate(addDaysStr(targetDate, -1))}
              className="w-9 h-9 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-sm font-bold flex items-center justify-center active:bg-stone-200 flex-shrink-0"
              aria-label="前日"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => {
                const el = dateInputRef.current;
                if (!el) return;
                const anyEl = el as HTMLInputElement & { showPicker?: () => void };
                if (typeof anyEl.showPicker === 'function') {
                  anyEl.showPicker();
                } else {
                  el.click();
                }
              }}
              className="flex-1 text-center px-2 py-1 rounded-xl active:bg-stone-50"
              aria-label="カレンダーから日付を選択"
            >
              <div className="text-xs text-stone-500 mb-1 flex items-center justify-center gap-1">
                <CalendarIcon className="w-4 h-4" strokeWidth={2.2} />
                <span>記録対象</span>
              </div>
              <div className="text-2xl font-bold text-stone-900">{dayLabel}</div>
              {(targetDate === todayStr || targetDate === yesterdayStr) && (
                <div className="text-xs text-stone-500 mt-0.5">{formatJpDateLabel(targetDate)}</div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTargetDate(addDaysStr(targetDate, 1))}
              className="w-9 h-9 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-sm font-bold flex items-center justify-center active:bg-stone-200 flex-shrink-0"
              aria-label="翌日"
            >
              ▶
            </button>
          </div>
          <input
            ref={dateInputRef}
            type="date"
            value={targetDate}
            onChange={(e) => {
              if (e.target.value) setTargetDate(e.target.value);
            }}
            className="sr-only"
          />
          <div className="text-center mb-3">
            <div className="inline-block bg-emerald-100 text-emerald-800 text-xl font-bold px-4 py-1 rounded-full">
              {mealType}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['朝食', '昼食', '夕食', '間食'] as MealType[]).map((m) => (
              <button
                key={m}
                onClick={() => setMealType(m)}
                className={`py-2.5 rounded-xl text-sm font-bold ${
                  mealType === m ? 'bg-emerald-500 text-white shadow-sm' : 'bg-stone-100 text-stone-700 border border-stone-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 6カードグリッド */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {/* 写真を撮る：labelでhidden inputをラップしてWebViewのカメラ起動を確実に */}
          <label
            htmlFor="record-camera-input"
            className="flex flex-col items-center justify-center bg-white rounded-2xl py-6 px-2 border border-stone-200 shadow-sm active:bg-emerald-50 cursor-pointer"
          >
            <Camera className="w-7 h-7 text-emerald-600 mb-2" strokeWidth={2} />
            <span className="text-sm font-bold text-stone-900 text-center leading-tight">写真を撮る</span>
          </label>
          <HubButton
            icon={<ImageIcon className="w-7 h-7 text-emerald-600" strokeWidth={2} />}
            label="画像から選ぶ"
            onClick={() => libraryInputRef.current?.click()}
          />
          <HubButton
            icon={<Star className="w-7 h-7 text-emerald-600" strokeWidth={2} />}
            label="マイメニュー"
            onClick={() => router.push(`/my-menu?date=${encodeURIComponent(targetDate)}&meal=${encodeURIComponent(mealType)}`)}
          />
          <HubButton
            icon={<Search className="w-7 h-7 text-emerald-600" strokeWidth={2} />}
            label="食品DB"
            onClick={() => router.push('/food-search')}
          />
          <label
            htmlFor="record-label-input"
            className="flex flex-col items-center justify-center bg-white rounded-2xl py-6 px-2 border border-stone-200 shadow-sm active:bg-emerald-50 cursor-pointer"
          >
            <ScanText className="w-7 h-7 text-emerald-600 mb-2" strokeWidth={2} />
            <span className="text-sm font-bold text-stone-900 text-center leading-tight">成分表を撮る</span>
          </label>
          <HubButton
            icon={<FileText className="w-7 h-7 text-emerald-600" strokeWidth={2} />}
            label="テキストで記録"
            onClick={() => setStage('memo')}
          />
        </div>

        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoChange}
          className="hidden"
        />
        <input
          id="record-camera-input"
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
        <input
          id="record-label-input"
          ref={labelInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleLabelPhotoChange}
          className="hidden"
        />

        {previews.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-3 mb-4">
            <div className="text-xs font-bold text-stone-700 mb-2">選択中の写真</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`p-${i}`} className="w-full aspect-square object-cover rounded-xl border border-stone-200" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 rounded-full font-bold shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">補足メモ（任意）</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例：味噌汁とサラダも食べた／ご飯は大盛り／ノンオイル"
              rows={3}
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
              撮り忘れた料理・量・調理法・調味料などを書くと、写真と合わせてAIが推定します
            </p>
          </div>
        )}
      </div>

      {/* 最下部固定アクションバー：写真があるときは解析する、無いときは食べなかった */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-40 shadow-lg">
        <div className="max-w-md mx-auto">
          {previews.length > 0 ? (
            <button
              onClick={() => runAnalyze(photos, comment)}
              className="w-full bg-emerald-500 text-white text-base font-bold py-4 rounded-2xl shadow-md active:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" strokeWidth={2} />
              解析する（{previews.length}枚）
            </button>
          ) : (
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="w-full bg-white border-2 border-stone-300 text-stone-700 font-bold py-3 rounded-2xl active:bg-stone-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {skipping ? '記録中…' : `🚫 ${mealType}は食べなかった`}
            </button>
          )}
        </div>
      </div>

      {/* 成分表結果モーダル */}
      {labelResult && (
        <LabelResultSheet
          result={labelResult}
          busy={labelBusy}
          day={dayLabel}
          mealType={mealType}
          onClose={() => setLabelResult(null)}
          onSave={(q, edited) => saveLabel(q, edited)}
        />
      )}
    </main>
  );
}

function LabelResultSheet({
  result,
  busy,
  day,
  mealType,
  onClose,
  onSave,
}: {
  result: {
    name: string;
    servingLabel: string;
    servings: number;
    perServing: { kcal: number; P: number; F: number; C: number };
    note: string;
  };
  busy: boolean;
  day: string;
  mealType: string;
  onClose: () => void;
  onSave: (
    quantity: number,
    edited?: {
      name: string;
      perServing: { kcal: number; P: number; F: number; C: number };
    }
  ) => void;
}) {
  const [quantity, setQuantity] = useState('1');
  // 編集機能
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState(result.name);
  const [eP, setEP] = useState(String(result.perServing.P));
  const [eF, setEF] = useState(String(result.perServing.F));
  const [eC, setEC] = useState(String(result.perServing.C));
  const [eKcalInput, setEKcalInput] = useState(String(result.perServing.kcal));
  const [autoCalc, setAutoCalc] = useState(true);
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);

  function n(v: string): number {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  }
  const calcKcal = Math.round(n(eP) * 4 + n(eF) * 9 + n(eC) * 4);
  const editedPerServing = {
    kcal: autoCalc ? calcKcal : Math.round(n(eKcalInput)),
    P: Math.round(n(eP) * 10) / 10,
    F: Math.round(n(eF) * 10) / 10,
    C: Math.round(n(eC) * 10) / 10,
  };

  const q = Math.max(0.1, Number(quantity) || 1);
  // 表示用：編集中なら編集値、そうでなければ元の値
  const displayName = editing ? eName : result.name;
  const k = editing ? editedPerServing : result.perServing;
  const total = {
    kcal: Math.round(k.kcal * q),
    P: Math.round(k.P * q * 10) / 10,
    F: Math.round(k.F * q * 10) / 10,
    C: Math.round(k.C * q * 10) / 10,
  };

  function handleSave() {
    if (editing) {
      onSave(q, { name: eName.trim() || result.name, perServing: editedPerServing });
    } else {
      onSave(q);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={busy ? undefined : onClose}>
      <div
        className={`bg-white shadow-2xl w-full overflow-y-auto ${
          expanded ? 'h-full rounded-none' : 'rounded-t-2xl max-h-[90vh]'
        }`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...handleProps}
          className="sticky top-0 bg-white pt-3 pb-2 border-b border-stone-200 z-10 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
              <ScanText className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              成分表から登録
            </h2>
            <button onClick={onClose} disabled={busy} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-stone-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-xs text-stone-600">商品名</div>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[11px] font-bold text-emerald-700 border border-emerald-600 px-2.5 py-0.5 rounded-full active:bg-emerald-50"
                >
                  編集
                </button>
              )}
            </div>
            {editing ? (
              <input
                type="text"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
                className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <div className="text-base font-bold text-stone-900 mt-0.5">{displayName}</div>
            )}
            <div className="text-[11px] text-stone-600 mt-1">単位：{result.servingLabel}</div>
          </div>

          {editing ? (
            <div className="bg-stone-50 border border-emerald-300 rounded-xl p-3 space-y-3">
              <div className="text-xs font-bold text-stone-700 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
                栄養素を補正（{result.servingLabel}）
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-rose-600 mb-1 block">P タンパク質(g)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={eP}
                    onChange={(e) => setEP(e.target.value)}
                    className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-600 mb-1 block">F 脂質(g)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={eF}
                    onChange={(e) => setEF(e.target.value)}
                    className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-sky-600 mb-1 block">C 炭水化物(g)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={eC}
                    onChange={(e) => setEC(e.target.value)}
                    className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                <div className="text-[10px] font-bold text-emerald-700 mb-1">自動計算カロリー</div>
                <div className="text-lg font-bold text-emerald-700">
                  {calcKcal}<span className="text-sm font-medium ml-1">kcal</span>
                </div>
                <p className="text-[10px] text-stone-600 mt-1">P×4 + F×9 + C×4 で算出</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // 元の値に戻す
                  setEName(result.name);
                  setEP(String(result.perServing.P));
                  setEF(String(result.perServing.F));
                  setEC(String(result.perServing.C));
                  setEKcalInput(String(result.perServing.kcal));
                  setAutoCalc(true);
                  setEditing(false);
                }}
                className="w-full text-[11px] text-stone-600 underline active:text-stone-800"
              >
                編集をやめて元に戻す
              </button>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl p-3">
              <div className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
                読み取り結果（{result.servingLabel}）
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mb-2">
                <Cell label="kcal" value={k.kcal} />
                <Cell label="P (g)" value={k.P} />
                <Cell label="F (g)" value={k.F} />
                <Cell label="C (g)" value={k.C} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">食べた量（{result.servingLabel} の倍数）</label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {['0.5', '1', '1.5', '2', '3'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setQuantity(v)}
                  className={`py-2 rounded-xl text-sm font-bold ${
                    quantity === v
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-700 border border-stone-300'
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-[11px] text-emerald-700 font-bold mb-1">記録される値</div>
            <div className="text-2xl font-bold text-emerald-700">{total.kcal}<span className="text-sm font-medium ml-1">kcal</span></div>
            <div className="text-xs text-stone-700 mt-1">P {total.P}g ・ F {total.F}g ・ C {total.C}g</div>
            <div className="text-[10px] text-stone-600 mt-1">{day}の{mealType}に記録</div>
          </div>

          {result.note && (
            <div className="text-[11px] text-stone-500 bg-stone-50 rounded-lg p-2 leading-relaxed">
              <span className="inline-flex items-start gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                {result.note}
              </span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={busy}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? (
              '記録中…'
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
                {q}× を {mealType}に記録
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-base font-bold text-stone-900">{value}</div>
      <div className="text-[10px] text-stone-600">{label}</div>
    </div>
  );
}

function HubButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center bg-white rounded-2xl py-6 px-2 border border-stone-200 shadow-sm active:bg-emerald-50"
    >
      <span className="mb-2 flex items-center justify-center">{icon}</span>
      <span className="text-sm font-bold text-stone-900 text-center leading-tight">{label}</span>
    </button>
  );
}

function NutRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-bold text-stone-900">{value}</div>
      <div className="text-[10px] text-stone-600">{label}</div>
    </div>
  );
}

function EditAnalyzedSheet({
  item,
  onClose,
  onSave,
}: {
  item: AnalyzedItem;
  onClose: () => void;
  onSave: (patch: Partial<Omit<AnalyzedItem, 'index'>>) => void;
}) {
  const [name, setName] = useState(item.name);
  const [portion, setPortion] = useState('1'); // 人前倍率
  const [P, setP] = useState(String(item.P));
  const [F, setF] = useState(String(item.F));
  const [C, setC] = useState(String(item.C));
  const { expanded, handleProps, sheetStyle } = useDraggableSheet(onClose);
  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  // PFC→kcal は常に自動計算
  const portionMul = Math.max(0.1, num(portion) || 1);
  const calcKcal = Math.round(num(P) * 4 + num(F) * 9 + num(C) * 4);
  const finalP = Math.round(num(P) * portionMul * 10) / 10;
  const finalF = Math.round(num(F) * portionMul * 10) / 10;
  const finalC = Math.round(num(C) * portionMul * 10) / 10;
  const finalKcal = Math.round(calcKcal * portionMul);
  const valid = name.trim().length > 0;

  function submit() {
    if (!valid) return;
    onSave({
      name: name.trim(),
      P: finalP,
      F: finalF,
      C: finalC,
      kcal: finalKcal,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-end" onClick={onClose}>
      <div
        className={`bg-white shadow-2xl w-full flex flex-col ${
          expanded ? 'h-full rounded-none' : 'rounded-t-2xl max-h-[88vh]'
        }`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...handleProps}
          className="bg-white pt-3 pb-3 border-b border-stone-200 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">食材を修正</h2>
            <button onClick={onClose} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              食材名 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：鮭フレーク 大さじ2"
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 人前倍率 */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="text-xs font-bold text-stone-700 mb-2">人前（量）</div>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {['0.5', '1', '1.5', '2', '3'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPortion(v)}
                  className={`py-1.5 rounded-lg text-xs font-bold ${
                    portion === v
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-white text-stone-700 border border-stone-300'
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                className="flex-1 bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-stone-700">人前</span>
            </div>
            {portionMul !== 1 && (
              <p className="text-[10px] text-emerald-700 mt-1">
                記録時に PFC・kcal を {portionMul}倍します
              </p>
            )}
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="text-xs font-bold text-stone-700 mb-2">栄養素（1人前あたり）</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-rose-600 mb-1 block">P タンパク質(g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={P}
                  onChange={(e) => setP(e.target.value)}
                  className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-600 mb-1 block">F 脂質(g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={F}
                  onChange={(e) => setF(e.target.value)}
                  className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-sky-600 mb-1 block">C 炭水化物(g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={C}
                  onChange={(e) => setC(e.target.value)}
                  className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-emerald-700 mb-1">自動計算カロリー</div>
            <div className="text-xl font-bold text-emerald-700">
              {calcKcal}<span className="text-sm font-medium ml-1">kcal</span>
            </div>
            <p className="text-[10px] text-stone-600 mt-1">P×4 + F×9 + C×4 で算出</p>
          </div>

          {portionMul !== 1 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="text-[10px] font-bold text-emerald-700 mb-1">記録される最終値（{portionMul}人前）</div>
              <div className="text-xl font-bold text-emerald-700">
                {finalKcal}<span className="text-sm font-medium ml-1">kcal</span>
              </div>
              <div className="text-xs text-stone-700 mt-0.5">
                P {finalP}g ・ F {finalF}g ・ C {finalC}g
              </div>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:bg-stone-300 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" strokeWidth={2.2} />
            変更を保存
          </button>
        </div>
      </div>
    </div>
  );
}
