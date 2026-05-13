'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached, invalidate } from '@/lib/clientCache';

type MealRecord = {
  pageId: string;
  mealType: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  memo: string;
  imageUrl: string | null;
  title: string;
  recordedAt: string;
};

type TodayData = {
  customer: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
  };
  today: {
    date: string;
    totals: { kcal: number; P: number; F: number; C: number };
    mealsByType: Record<string, MealRecord[]>;
  };
};

const MEAL_EMOJI: Record<string, string> = {
  朝食: '🌅',
  昼食: '☀️',
  夕食: '🌙',
  間食: '🍪',
};

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatJpDateShort(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}(${wd})`;
}

function shortName(r: MealRecord): string {
  const memo = (r.memo || '').trim();
  if (!memo) return r.title || '食事';
  // 「先頭の食材名」を抽出（、で区切られた1つ目、または "AI識別:" の前半）
  const beforeAi = memo.split(/\s*\/\s*AI識別[:：]/)[0] || memo;
  const firstItem = beforeAi.split(/[、,]/)[0]?.trim();
  return firstItem || beforeAi.slice(0, 30);
}

function unitFromName(name: string): string {
  // 名前末尾の分量表現を抽出。例「ご飯 150g」→ "150g"、「焼き鮭 1切れ」→ "1切れ"
  const m = name.match(/\s+([0-9０-９.]+\s*(g|ml|個|本|杯|皿|枚|切れ|人前|匹|玉|串|缶|袋|箱|食|kg))$/);
  if (m) return m[1].trim();
  const m2 = name.match(/[（(]([^）)]+)[）)]\s*$/);
  if (m2 && /[0-9０-９]/.test(m2[1])) return m2[1].trim();
  return '1人前';
}

export default function MealDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-stone-800">読み込み中...</div>
        </main>
      }
    >
      <MealDetailInner />
    </Suspense>
  );
}

function MealDetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const mealParam = searchParams.get('meal') || '朝食';

  const todayStr = jstTodayString();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MealRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MealRecord | null>(null);
  const [portionEditing, setPortionEditing] = useState<MealRecord | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (!profile) {
          setError('LINEプロフィール取得失敗');
          setReady(true);
          return;
        }
        setUserId(profile.userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
        setReady(true);
      }
    })();
  }, []);

  async function fetchData() {
    if (!userId) return;
    const res = await fetch(
      `/api/today?lineUserId=${encodeURIComponent(userId)}&date=${date}&t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      throw new Error(`データ取得失敗（${res.status}）`);
    }
    const json: TodayData = await res.json();
    setData(json);
    setCached(`today_v2_${userId}_${date}`, json);
  }

  useEffect(() => {
    if (!userId) return;
    const cached = getCached<TodayData>(`today_v2_${userId}_${date}`);
    if (cached) {
      setData(cached.data);
      setReady(true);
      if (!cached.isStale) return;
    } else {
      setReady(false);
    }
    setError(null);
    fetchData()
      .catch((e) => {
        if (!cached) setError(e instanceof Error ? e.message : '読み込みエラー');
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date]);

  async function handleDelete(record: MealRecord) {
    if (!userId) return;
    setDeletingId(record.pageId);
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: record.pageId, lineUserId: userId }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `削除失敗（${res.status}）`);
      }
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      await fetchData();
      setConfirmDelete(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除エラー');
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6">
        <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl text-sm">
          {error}
        </div>
      </main>
    );
  }

  if (!data) return null;

  const records = data.today.mealsByType[mealParam] || [];
  const totals = records.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      P: acc.P + r.P,
      F: acc.F + r.F,
      C: acc.C + r.C,
    }),
    { kcal: 0, P: 0, F: 0, C: 0 }
  );
  const emoji = MEAL_EMOJI[mealParam] || '🍽️';

  return (
    <main className="min-h-screen bg-stone-50 pb-32">
      <header className="bg-white px-4 py-3 sticky top-0 z-30 shadow-sm border-b border-stone-200">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-stone-700 text-2xl w-8 leading-none">
            ×
          </button>
          <h1 className="text-base font-bold text-stone-900">
            {formatJpDateShort(date)} {emoji} {mealParam}
          </h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 py-4">
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <div className="text-3xl mb-2">{emoji}</div>
            <div className="text-sm font-bold text-stone-800 mb-1">{mealParam}は未記録です</div>
            <div className="text-xs text-stone-600 leading-relaxed">
              下の「メニューを追加」から記録できます。
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {records.map((r, i) => (
              <div
                key={r.pageId}
                className={`flex items-center px-3 py-3 ${
                  i > 0 ? 'border-t border-stone-100' : ''
                }`}
              >
                <button
                  onClick={() => setConfirmDelete(r)}
                  disabled={deletingId === r.pageId}
                  className="w-7 h-7 rounded-full border-2 border-stone-300 text-stone-500 flex items-center justify-center text-base font-bold flex-shrink-0 active:bg-stone-100 disabled:opacity-50"
                  aria-label="削除"
                >
                  {deletingId === r.pageId ? '…' : '×'}
                </button>
                <div className="flex-1 min-w-0 ml-3">
                  <div className="text-sm font-bold text-stone-900 truncate">
                    {shortName(r)}
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">
                    {Math.round(r.kcal)} kcal ・ P{r1(r.P)}・F{r1(r.F)}・C{r1(r.C)}
                  </div>
                </div>
                <button
                  onClick={() => setEditing(r)}
                  className="flex-shrink-0 text-[11px] font-bold text-emerald-700 border border-emerald-600 px-2.5 py-1 rounded-full active:bg-emerald-50 mr-2"
                  type="button"
                >
                  編集
                </button>
                <button
                  onClick={() => setPortionEditing(r)}
                  className="flex-shrink-0 text-[11px] font-medium text-stone-700 border border-stone-300 px-2.5 py-1 rounded-full active:bg-stone-100"
                  type="button"
                  aria-label="分量を変更"
                >
                  {unitFromName(shortName(r))}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() =>
            router.push(`/record?meal=${encodeURIComponent(mealParam)}&day=${date === todayStr ? '今日' : '昨日'}`)
          }
          className="w-full mt-4 bg-white border-2 border-dashed border-emerald-400 text-emerald-700 font-bold py-3 rounded-2xl active:bg-emerald-50"
        >
          ＋ メニューを追加
        </button>
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-40 shadow-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[10px] text-stone-500 font-medium">{mealParam}合計</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-stone-900">{Math.round(totals.kcal)}</span>
              <span className="text-xs text-stone-500">kcal</span>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-2xl active:bg-emerald-700 flex items-center justify-center gap-2"
          >
            <span>完了</span>
            <span className="bg-white text-emerald-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {records.length}
            </span>
          </button>
        </div>
      </div>

      {editing && userId && (
        <EditModal
          record={editing}
          lineUserId={userId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            invalidate('today_');
            invalidate('weekly_');
            invalidate('history_');
            await fetchData();
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDelete
          record={confirmDelete}
          loading={deletingId === confirmDelete.pageId}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}

      {portionEditing && userId && (
        <PortionSheet
          record={portionEditing}
          lineUserId={userId}
          onClose={() => setPortionEditing(null)}
          onSaved={async () => {
            invalidate('today_');
            invalidate('weekly_');
            invalidate('history_');
            await fetchData();
            setPortionEditing(null);
          }}
        />
      )}
    </main>
  );
}

function PortionSheet({
  record,
  lineUserId,
  onClose,
  onSaved,
}: {
  record: MealRecord;
  lineUserId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [multiplier, setMultiplier] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const m = Number(multiplier);
  const valid = Number.isFinite(m) && m > 0 && m <= 20;
  const newKcal = valid ? Math.round(record.kcal * m) : 0;
  const newP = valid ? Math.round(record.P * m * 10) / 10 : 0;
  const newF = valid ? Math.round(record.F * m * 10) / 10 : 0;
  const newC = valid ? Math.round(record.C * m * 10) / 10 : 0;

  const presets = [0.5, 0.7, 1, 1.5, 2];

  async function apply() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/record/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: record.pageId,
          lineUserId,
          kcal: newKcal,
          P: newP,
          F: newF,
          C: newC,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `更新失敗（${res.status}）`);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[75] flex items-end" onClick={saving ? undefined : onClose}>
      <div className="bg-white rounded-t-2xl shadow-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="pt-3 pb-2 border-b border-stone-200">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">分量（人前）を変更</h2>
            <button onClick={onClose} disabled={saving} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-stone-50 rounded-xl p-3">
            <div className="text-sm font-bold text-stone-900 truncate">{shortName(record)}</div>
            <div className="text-[11px] text-stone-600 mt-0.5">
              現在：{Math.round(record.kcal)} kcal ・ P{r1(record.P)}・F{r1(record.F)}・C{r1(record.C)}
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}

          <div>
            <label className="text-xs font-bold text-stone-700 mb-2 block">
              何人前にしますか？
              <span className="ml-2 text-[10px] font-normal text-stone-500">
                （0.7 → 全部0.7倍／2 → 全部2倍）
              </span>
            </label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMultiplier(String(p))}
                  className={`py-2 rounded-xl text-sm font-bold ${
                    multiplier === String(p)
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-700 border border-stone-300'
                  }`}
                >
                  {p}人前
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                max="20"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                placeholder="例：0.7"
                className="flex-1 bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="text-sm font-bold text-stone-700">人前</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-[11px] text-emerald-700 font-bold mb-1">変更後</div>
            <div className="text-2xl font-bold text-emerald-700">
              {newKcal} <span className="text-sm font-medium">kcal</span>
            </div>
            <div className="text-xs text-stone-700 mt-1">
              P {newP}g ・ F {newF}g ・ C {newC}g
            </div>
            {valid && m !== 1 && (
              <div className="text-[10px] text-stone-500 mt-1">
                すべての値を {m}倍 します
              </div>
            )}
          </div>

          <button
            onClick={apply}
            disabled={!valid || saving || m === 1}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500"
          >
            {saving ? '更新中…' : `✅ ${m === 1 ? '変更なし' : `${m}人前に変更`}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  record,
  loading,
  onCancel,
  onConfirm,
}: {
  record: MealRecord;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center px-6" onClick={loading ? undefined : onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-3xl mb-2 text-center">🗑️</div>
        <h3 className="text-base font-bold text-stone-900 mb-2 text-center">この記録を削除しますか？</h3>
        <div className="bg-stone-50 rounded-xl p-3 mb-4 text-center">
          <div className="text-sm font-bold text-stone-800">{shortName(record)}</div>
          <div className="text-xs text-stone-600 mt-1">
            {Math.round(record.kcal)} kcal ・ P{r1(record.P)}・F{r1(record.F)}・C{r1(record.C)}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-stone-100 text-stone-700 font-bold py-3 rounded-xl active:bg-stone-200 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl active:bg-red-700 disabled:opacity-50"
          >
            {loading ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  record,
  lineUserId,
  onClose,
  onSaved,
}: {
  record: MealRecord;
  lineUserId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState(shortName(record));
  const [kcal, setKcal] = useState(String(Math.round(record.kcal)));
  const [P, setP] = useState(String(r1(record.P)));
  const [F, setF] = useState(String(r1(record.F)));
  const [C, setC] = useState(String(r1(record.C)));
  const [autoCalc, setAutoCalc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numOr = (v: string): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const calcKcal = Math.round(numOr(P) * 4 + numOr(F) * 9 + numOr(C) * 4);
  const displayKcal = autoCalc ? calcKcal : numOr(kcal);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/record/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: record.pageId,
          lineUserId,
          kcal: displayKcal,
          P: numOr(P),
          F: numOr(F),
          C: numOr(C),
          memo: name,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `更新失敗（${res.status}）`);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={saving ? undefined : onClose}>
      <div
        className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white pt-3 pb-2 border-b border-stone-200 z-10">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">食事を編集</h2>
            <button onClick={onClose} className="text-stone-500 text-2xl leading-none px-2" disabled={saving}>×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">食事名・食材メモ</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">P(g)</label>
              <input
                type="number"
                inputMode="decimal"
                value={P}
                onChange={(e) => setP(e.target.value)}
                className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">F(g)</label>
              <input
                type="number"
                inputMode="decimal"
                value={F}
                onChange={(e) => setF(e.target.value)}
                className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">C(g)</label>
              <input
                type="number"
                inputMode="decimal"
                value={C}
                onChange={(e) => setC(e.target.value)}
                className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-stone-700 block">kcal</label>
              <button
                type="button"
                onClick={() => setAutoCalc((v) => !v)}
                className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                  autoCalc
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                PFCから自動計算
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={autoCalc ? String(calcKcal) : kcal}
              onChange={(e) => setKcal(e.target.value)}
              disabled={autoCalc}
              className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-stone-100"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '更新中…' : '✅ 更新する'}
          </button>
        </div>
      </div>
    </div>
  );
}

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}
