'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import FooterNav from '@/components/FooterNav';
import PageHeader from '@/components/PageHeader';
import { initLiff, getLineProfile } from '@/lib/liff';
import { invalidate } from '@/lib/clientCache';
import {
  loadMyMenu,
  addMyMenuItem,
  removeMyMenuItem,
  touchMyMenuItem,
  updateMyMenuItem,
  type MyMenuItem,
} from '@/lib/myMenu';

type MealType = '朝食' | '昼食' | '夕食' | '間食';

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

export default function MyMenuPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-stone-800">読み込み中...</div>
        </main>
      }
    >
      <MyMenuInner />
    </Suspense>
  );
}

function MyMenuInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const todayStr = jstTodayString();
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;
  const initialMeal = (searchParams.get('meal') as MealType) || '昼食';

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<MyMenuItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MyMenuItem | null>(null);
  const [recordPicker, setRecordPicker] = useState<MyMenuItem | null>(null);
  // クエリパラメータからの初期値
  const defaultDate: string = initialDate;
  const defaultMeal: MealType = initialMeal;

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
        setItems(loadMyMenu());
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化失敗');
        setReady(true);
      }
    })();
  }, []);

  async function handleRecord(item: MyMenuItem, targetDate: string, mealType: MealType) {
    if (!userId) return;
    setBusy(item.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/record/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          mealType,
          date: targetDate,
          title: `${item.name}（${item.unit}）`,
          kcal: item.kcal,
          P: item.P,
          F: item.F,
          C: item.C,
          source: 'my_menu',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `記録失敗（${res.status}）`);
      }
      touchMyMenuItem(item.id);
      setItems(loadMyMenu());
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      const dayLabel =
        targetDate === todayStr
          ? '今日'
          : targetDate === addDaysStr(todayStr, -1)
          ? '昨日'
          : formatJpDateLabel(targetDate);
      setSuccess(`${item.name} を ${dayLabel}の${mealType} に記録しました`);
      setRecordPicker(null);
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setBusy(null);
    }
  }

  function handleRemove(id: string) {
    if (!confirm('マイメニューから削除します。よろしいですか？')) return;
    removeMyMenuItem(id);
    setItems(loadMyMenu());
  }

  function handleAdd(form: {
    name: string;
    unit: string;
    kcal: number;
    P: number;
    F: number;
    C: number;
  }) {
    addMyMenuItem(form);
    setItems(loadMyMenu());
    setShowAdd(false);
  }

  function handleUpdate(
    id: string,
    form: { name: string; unit: string; kcal: number; P: number; F: number; C: number }
  ) {
    updateMyMenuItem(id, form);
    setItems(loadMyMenu());
    setEditing(null);
    setSuccess('マイメニューを更新しました');
    setTimeout(() => setSuccess(null), 2000);
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-44">
      <PageHeader
        title="⭐ マイメニュー"
        subtitle="よく食べる料理を保存・呼び出し"
        back
      />

      <main className="px-4 py-4 space-y-3">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs font-medium p-3 rounded-xl">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-medium p-3 rounded-xl">
            ✅ {success}
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <div className="text-3xl mb-2">⭐</div>
            <div className="text-sm font-bold text-stone-800 mb-1">マイメニューは空です</div>
            <div className="text-xs text-stone-600 leading-relaxed">
              よく食べる料理を登録しておくと、食事記録時にすぐ呼び出せます。
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isBusy = busy === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-white border border-stone-200 rounded-xl p-3 flex items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-stone-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-stone-600 mt-0.5">
                      {item.unit} ・ P{item.P}・F{item.F}・C{item.C}g
                      {item.useCount && item.useCount > 0 && (
                        <span className="ml-2 text-emerald-700">使用 {item.useCount}回</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3 mr-2">
                    <div className="text-sm font-bold text-stone-900">{item.kcal}</div>
                    <div className="text-[10px] text-stone-500">kcal</div>
                  </div>
                  <button
                    onClick={() => setRecordPicker(item)}
                    disabled={isBusy || !!busy}
                    className="w-9 h-9 rounded-full bg-emerald-500 text-white text-lg font-bold flex items-center justify-center disabled:opacity-50 active:bg-emerald-700 mr-1"
                    aria-label="記録する"
                  >
                    {isBusy ? '…' : '+'}
                  </button>
                  <button
                    onClick={() => setEditing(item)}
                    className="text-xs text-stone-500 px-1 active:text-emerald-700"
                    aria-label="編集"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-xs text-stone-400 px-1 active:text-red-600"
                    aria-label="削除"
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <Link href="/home" className="block text-center text-xs text-stone-500 underline pt-4">
          🏠 ホームに戻る
        </Link>
      </main>

      {/* 下部固定の追加ボタン（FooterNav の上） */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-40 shadow-lg">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-2xl shadow-md active:bg-emerald-700"
            type="button"
          >
            ＋ 新しいメニューを追加
          </button>
        </div>
      </div>

      {showAdd && (
        <AddItemSheet
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdd}
        />
      )}

      {editing && (
        <EditItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSubmit={(form) => handleUpdate(editing.id, form)}
        />
      )}

      {recordPicker && (
        <RecordPickerSheet
          item={recordPicker}
          defaultDate={defaultDate}
          defaultMeal={defaultMeal}
          todayStr={todayStr}
          loading={busy === recordPicker.id}
          onClose={() => setRecordPicker(null)}
          onConfirm={(date, mealType) => handleRecord(recordPicker, date, mealType)}
        />
      )}

      <FooterNav />
    </div>
  );
}

function RecordPickerSheet({
  item,
  defaultDate,
  defaultMeal,
  todayStr,
  loading,
  onClose,
  onConfirm,
}: {
  item: MyMenuItem;
  defaultDate: string;
  defaultMeal: MealType;
  todayStr: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (date: string, mealType: MealType) => void;
}) {
  const [targetDate, setTargetDate] = useState<string>(defaultDate);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dayLabel =
    targetDate === todayStr
      ? '今日'
      : targetDate === addDaysStr(todayStr, -1)
      ? '昨日'
      : formatJpDateLabel(targetDate);

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={loading ? undefined : onClose}>
      <div className="bg-white rounded-t-2xl shadow-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="pt-3 pb-2 border-b border-stone-200">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">記録先を選択</h2>
            <button onClick={onClose} disabled={loading} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-stone-50 rounded-xl p-3">
            <div className="text-sm font-bold text-stone-900 truncate">{item.name}</div>
            <div className="text-[11px] text-stone-600 mt-0.5">
              {item.unit} ・ {item.kcal} kcal ・ P{item.P}・F{item.F}・C{item.C}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-stone-700 mb-1">日付</div>
            <div className="flex items-center gap-2">
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
                  if (typeof anyEl.showPicker === 'function') anyEl.showPicker();
                  else el.click();
                }}
                className="flex-1 py-2 rounded-xl text-sm font-bold bg-emerald-500 text-white active:bg-emerald-700 flex items-center justify-center gap-1"
              >
                📅 {dayLabel}
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
          </div>
          <div>
            <div className="text-xs font-bold text-stone-700 mb-1">食事区分</div>
            <div className="grid grid-cols-4 gap-2">
              {(['朝食', '昼食', '夕食', '間食'] as MealType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMealType(m)}
                  className={`py-2 rounded-xl text-sm font-bold ${
                    mealType === m ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-700 border border-stone-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => onConfirm(targetDate, mealType)}
            disabled={loading}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? '記録中…' : `✅ ${dayLabel}の${mealType}に記録`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItemSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (form: {
    name: string;
    unit: string;
    kcal: number;
    P: number;
    F: number;
    C: number;
  }) => void;
}) {
  const [tab, setTab] = useState<'db' | 'manual'>('db');
  const [filled, setFilled] = useState(false); // DBから値が入った状態
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('1人前');
  const [kcal, setKcal] = useState('');
  const [P, setP] = useState('');
  const [F, setF] = useState('');
  const [C, setC] = useState('');
  const [autoCalc, setAutoCalc] = useState(false);
  const [dbQuery, setDbQuery] = useState('');
  const [dbResults, setDbResults] = useState<Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    kcal: number;
    P: number;
    F: number;
    C: number;
  }>>([]);
  const [dbSearching, setDbSearching] = useState(false);

  useEffect(() => {
    if (!dbQuery.trim()) {
      setDbResults([]);
      return;
    }
    setDbSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/food-search?q=${encodeURIComponent(dbQuery)}&limit=20`)
        .then((r) => r.json())
        .then((j) => setDbResults(j.items || []))
        .catch(() => setDbResults([]))
        .finally(() => setDbSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [dbQuery]);

  function pickFromDb(item: { name: string; unit: string; kcal: number; P: number; F: number; C: number }) {
    setName(item.name);
    setUnit(item.unit);
    setKcal(String(item.kcal));
    setP(String(item.P));
    setF(String(item.F));
    setC(String(item.C));
    setAutoCalc(false);
    setDbQuery('');
    setDbResults([]);
    setFilled(true);
  }

  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  const calcKcal = Math.round(num(P) * 4 + num(F) * 9 + num(C) * 4);
  const displayKcal = autoCalc ? calcKcal : num(kcal);
  const valid = name.trim().length > 0 && (displayKcal > 0 || num(P) + num(F) + num(C) > 0);

  function submit() {
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      unit: unit.trim() || '1人前',
      kcal: displayKcal,
      P: num(P),
      F: num(F),
      C: num(C),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl shadow-2xl w-full h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white pt-3 pb-0 border-b border-stone-200 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5 mb-3">
            <h2 className="text-base font-bold text-stone-900">⭐ 新しいメニューを追加</h2>
            <button onClick={onClose} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
          {/* タブ：DB / 手入力 */}
          <div className="grid grid-cols-2 gap-0 px-5">
            <button
              type="button"
              onClick={() => setTab('db')}
              className={`pb-2 text-sm font-bold border-b-2 ${
                tab === 'db'
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-stone-500 active:text-stone-700'
              }`}
            >
              📚 食品DBから選ぶ
            </button>
            <button
              type="button"
              onClick={() => setTab('manual')}
              className={`pb-2 text-sm font-bold border-b-2 ${
                tab === 'manual'
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-stone-500 active:text-stone-700'
              }`}
            >
              ✏️ 自分で入力
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {tab === 'db' ? (
            <>
              <p className="text-xs text-stone-600 leading-relaxed">
                食品DBから選ぶと、PFC・kcal が <strong>自動で入ります</strong>。
              </p>
              <input
                type="text"
                value={dbQuery}
                onChange={(e) => setDbQuery(e.target.value)}
                placeholder="🔍 例：おにぎり、ラーメン、プロテイン"
                autoFocus
                className="w-full bg-white text-stone-900 placeholder:text-stone-400 border-2 border-emerald-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {dbSearching && <div className="text-xs text-stone-500">検索中…</div>}
              {dbResults.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {dbResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pickFromDb(item)}
                      className="w-full flex items-center justify-between bg-white border border-stone-200 rounded-xl px-3 py-2.5 active:bg-emerald-50 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-stone-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-stone-600 mt-0.5">
                          {item.unit} ・ P{item.P}・F{item.F}・C{item.C}g
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0 text-right">
                        <div className="text-sm font-bold text-stone-900">{item.kcal}</div>
                        <div className="text-[9px] text-stone-500">kcal</div>
                      </div>
                      <div className="ml-2 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        ＋
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {dbQuery.trim() && !dbSearching && dbResults.length === 0 && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-600 leading-relaxed">
                  該当する食品がありません。<br />
                  <button
                    type="button"
                    onClick={() => {
                      setName(dbQuery);
                      setTab('manual');
                    }}
                    className="text-emerald-700 underline font-bold mt-1"
                  >
                    「{dbQuery}」を自分で入力する →
                  </button>
                </div>
              )}

              {/* DBから選択済みの場合のプレビュー＋保存 */}
              {filled && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 mt-3">
                  <div className="text-xs font-bold text-emerald-800 mb-1">✅ 選択中のメニュー</div>
                  <div className="text-base font-bold text-stone-900">{name}</div>
                  <div className="text-xs text-stone-700 mt-1">
                    {unit} ・ {kcal}kcal ・ P{P}・F{F}・C{C}g
                  </div>
                  <button
                    onClick={submit}
                    disabled={!valid}
                    className="w-full mt-3 bg-emerald-500 text-white font-bold py-3 rounded-2xl active:bg-emerald-700 disabled:bg-stone-300"
                  >
                    ⭐ マイメニューに保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilled(false);
                      setTab('manual');
                    }}
                    className="w-full mt-1 text-[11px] text-stone-600 underline"
                  >
                    値を編集する
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-stone-600 leading-relaxed">
                料理名と PFC を入力してください。kcal は <strong>自動計算ボタン</strong> で算出できます。
              </p>

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">
                  料理名 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFilled(false);
                  }}
                  placeholder="例：プロテイン、サラダチキン"
                  className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">分量・単位</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="例：1人前、1杯、1個、100g"
                  className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <div className="text-xs font-bold text-stone-700 mb-2">栄養素 <span className="text-rose-600">*</span></div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-rose-600 mb-1 block">P タンパク質(g)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={P}
                      onChange={(e) => setP(e.target.value)}
                      placeholder="20"
                      className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-600 mb-1 block">F 脂質(g)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={F}
                      onChange={(e) => setF(e.target.value)}
                      placeholder="10"
                      className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-sky-600 mb-1 block">C 炭水化物(g)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={C}
                      onChange={(e) => setC(e.target.value)}
                      placeholder="30"
                      className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700 block">kcal カロリー</label>
                  <button
                    type="button"
                    onClick={() => setAutoCalc((v) => !v)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                      autoCalc
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    {autoCalc ? '✓ PFCから自動計算中' : 'PFCから自動計算'}
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={autoCalc ? String(calcKcal) : kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  disabled={autoCalc}
                  placeholder="例：280"
                  className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100"
                />
                {autoCalc && (
                  <p className="text-[10px] text-emerald-700 mt-1">
                    P×4 + F×9 + C×4 = {calcKcal}kcal
                  </p>
                )}
              </div>

              <button
                onClick={submit}
                disabled={!valid}
                className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500"
              >
                {valid ? '⭐ マイメニューに保存' : '料理名と栄養素を入力してください'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditItemSheet({
  item,
  onClose,
  onSubmit,
}: {
  item: MyMenuItem;
  onClose: () => void;
  onSubmit: (form: {
    name: string;
    unit: string;
    kcal: number;
    P: number;
    F: number;
    C: number;
  }) => void;
}) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [kcal, setKcal] = useState(String(item.kcal));
  const [P, setP] = useState(String(item.P));
  const [F, setF] = useState(String(item.F));
  const [C, setC] = useState(String(item.C));
  const [autoCalc, setAutoCalc] = useState(false);

  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  const calcKcal = Math.round(num(P) * 4 + num(F) * 9 + num(C) * 4);
  const displayKcal = autoCalc ? calcKcal : num(kcal);
  const valid = name.trim().length > 0 && (displayKcal > 0 || num(P) + num(F) + num(C) > 0);

  function submit() {
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      unit: unit.trim() || '1人前',
      kcal: displayKcal,
      P: num(P),
      F: num(F),
      C: num(C),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white pt-3 pb-3 border-b border-stone-200 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-5">
            <h2 className="text-base font-bold text-stone-900">✏️ マイメニューを編集</h2>
            <button onClick={onClose} className="text-stone-500 text-2xl leading-none px-2">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              料理名 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：プロテイン、サラダチキン"
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">分量・単位</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="例：1人前、1杯、1個、100g"
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="text-xs font-bold text-stone-700 mb-2">栄養素 <span className="text-rose-600">*</span></div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-rose-600 mb-1 block">P タンパク質(g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={P}
                  onChange={(e) => setP(e.target.value)}
                  placeholder="20"
                  className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-600 mb-1 block">F 脂質(g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={F}
                  onChange={(e) => setF(e.target.value)}
                  placeholder="10"
                  className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-sky-600 mb-1 block">C 炭水化物(g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={C}
                  onChange={(e) => setC(e.target.value)}
                  placeholder="30"
                  className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-stone-700 block">kcal カロリー</label>
              <button
                type="button"
                onClick={() => setAutoCalc((v) => !v)}
                className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                  autoCalc
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                {autoCalc ? '✓ PFCから自動計算中' : 'PFCから自動計算'}
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={autoCalc ? String(calcKcal) : kcal}
              onChange={(e) => setKcal(e.target.value)}
              disabled={autoCalc}
              placeholder="例：280"
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-3 text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100"
            />
            {autoCalc && (
              <p className="text-[10px] text-emerald-700 mt-1">
                P×4 + F×9 + C×4 = {calcKcal}kcal
              </p>
            )}
          </div>

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500"
          >
            {valid ? '💾 変更を保存' : '料理名と栄養素を入力してください'}
          </button>
        </div>
      </div>
    </div>
  );
}
