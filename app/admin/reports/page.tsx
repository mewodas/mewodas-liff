'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  Send,
  Sparkles,
  RefreshCw,
  Check,
  FileText,
  MessageCircle,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import DateRangePicker from '../DateRangePicker';

type Customer = { pageId: string; name: string; foodStatus: string | null; storeId: string | null };
type Store = { pageId: string; storeId: string; name: string; signature: string };
type Template = { id: string; name: string; category: string; titleTemplate: string; bodyTemplate: string; useAi: boolean; aiPrompt: string; rangeType?: string; sortOrder?: number };

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function addDaysStr(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function rangeTypeToFromTo(rangeType: string | undefined, today: string): { from: string; to: string } | null {
  if (!rangeType || rangeType === 'カスタム') return null;
  const [y, m, d] = today.split('-').map(Number);
  const todayDt = new Date(y, m - 1, d);
  if (rangeType === '今日') return { from: today, to: today };
  if (rangeType === '昨日') {
    const dt = new Date(todayDt);
    dt.setDate(dt.getDate() - 1);
    const s = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { from: s, to: s };
  }
  if (rangeType === '今週') {
    const dow = todayDt.getDay();
    const monday = new Date(todayDt);
    monday.setDate(todayDt.getDate() - ((dow === 0 ? 7 : dow) - 1));
    const s = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    return { from: s, to: today };
  }
  if (rangeType === '先週') {
    const dow = todayDt.getDay();
    const lastMonday = new Date(todayDt);
    lastMonday.setDate(todayDt.getDate() - ((dow === 0 ? 7 : dow) - 1) - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    const s = `${lastMonday.getFullYear()}-${String(lastMonday.getMonth() + 1).padStart(2, '0')}-${String(lastMonday.getDate()).padStart(2, '0')}`;
    const e = `${lastSunday.getFullYear()}-${String(lastSunday.getMonth() + 1).padStart(2, '0')}-${String(lastSunday.getDate()).padStart(2, '0')}`;
    return { from: s, to: e };
  }
  if (rangeType === '今月') {
    const firstDay = new Date(todayDt.getFullYear(), todayDt.getMonth(), 1);
    const s = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
    return { from: s, to: today };
  }
  if (rangeType === '先月') {
    const firstDay = new Date(todayDt.getFullYear(), todayDt.getMonth() - 1, 1);
    const lastDay = new Date(todayDt.getFullYear(), todayDt.getMonth(), 0);
    const s = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
    const e = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    return { from: s, to: e };
  }
  return null;
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-stone-500">読み込み中…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const pathname = usePathname() || '';
  const isStore = pathname.startsWith('/store');
  const initialCustomerId = sp.get('customerId') || '';
  const initialDraft = sp.get('draft') || '';
  const today = jstToday();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [templateId, setTemplateId] = useState<string>('');
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);

  const [title, setTitle] = useState(initialDraft ? 'トレーナーからのレポート' : '');
  const [body, setBody] = useState(initialDraft);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingLine, setSendingLine] = useState(false);
  const [sendLinePush, setSendLinePush] = useState(true);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // body が「テンプレ由来の初期値」のままか、ユーザーが編集したかを判定するため
  // テンプレ適用時の値を ref に保持
  const templateBaselineRef = useRef<{ title: string; body: string }>({ title: '', body: initialDraft });

  const startDate = from;
  const endDate = to;
  const isSingleDay = from === to;
  function shiftRange(delta: number) {
    setFrom(addDaysStr(from, delta));
    setTo(addDaysStr(to, delta));
  }

  useEffect(() => {
    (async () => {
      // 各 API を独立して try/catch。1つ失敗しても他は動かす。
      async function safeFetch<T>(url: string, fallback: T): Promise<T> {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) return fallback;
          const text = await res.text();
          if (!text) return fallback;
          try {
            return JSON.parse(text) as T;
          } catch {
            return fallback;
          }
        } catch {
          return fallback;
        }
      }
      try {
        const [cJ, sJ, tJ] = await Promise.all([
          safeFetch<{ customers?: Customer[] }>('/api/admin/customers', {}),
          safeFetch<{ stores?: Store[] }>('/api/admin/stores', {}),
          fetch('/api/admin/templates', { cache: 'no-store' })
            .then(async (res) => {
              if (!res.ok) throw new Error(`テンプレ取得失敗（${res.status}）`);
              const j = await res.json();
              return j as { templates?: Template[]; error?: string; hint?: string };
            })
            .catch((e: unknown) => {
              setTemplateError(e instanceof Error ? e.message : 'テンプレ取得エラー');
              return {} as { templates?: Template[] };
            }),
        ]);
        setCustomers((cJ.customers || []).filter((c: Customer) => !!c.foodStatus));
        setStores(sJ.stores || []);
        const tList: Template[] = tJ.templates || [];
        setTemplates(tList);
        if (tJ && 'error' in tJ && tJ.error) {
          setTemplateError((tJ as { hint?: string; error?: string }).hint || (tJ as { error?: string }).error || null);
        }
        if (!initialDraft && tList.length > 0) {
          setTemplateId(tList[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [initialDraft]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.pageId === customerId), [customers, customerId]);
  const customerStore = useMemo(() => {
    if (!selectedCustomer?.storeId) return null;
    return stores.find((s) => s.storeId === selectedCustomer.storeId) || null;
  }, [selectedCustomer, stores]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  // テンプレ切替時：タイトル・本文をテンプレのベーステキストで上書き
  // ただしユーザーが編集済みなら上書きしない
  // rangeType がある場合は from/to も自動更新（バグ1修正）
  useEffect(() => {
    if (!selectedTemplate) return;
    const baseTitle = selectedTemplate.titleTemplate || '';
    const baseBody = selectedTemplate.bodyTemplate || '';
    const userEditedTitle = title !== templateBaselineRef.current.title && title !== '';
    const userEditedBody = body !== templateBaselineRef.current.body && body !== '';
    if (!userEditedTitle) setTitle(baseTitle);
    if (!userEditedBody) setBody(baseBody);
    templateBaselineRef.current = { title: baseTitle, body: baseBody };
    const range = rangeTypeToFromTo(selectedTemplate.rangeType, today);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, templates]);

  async function generate() {
    if (!customerId) {
      setError('顧客を選択してください');
      return;
    }
    setGenerating(true);
    setError(null);
    setResultMsg(null);
    try {
      const res = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          templateId: templateId || undefined,
          startDate,
          endDate,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `生成失敗（${res.status}）`);
      }
      const j = await res.json();
      setTitle(j.title || '');
      setBody(j.body || '');
      templateBaselineRef.current = { title: j.title || '', body: j.body || '' };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    if (!customerId || !title.trim() || !body.trim()) {
      setError('顧客・タイトル・本文すべて必要');
      return;
    }
    setSending(true);
    setError(null);
    setResultMsg(null);
    try {
      const category = selectedTemplate?.category || 'カスタム';
      // 顧客の所属店舗の署名を本文末尾に自動付与（テンプレに署名が無い場合のみ）
      const sig = customerStore?.signature?.trim() || '';
      const bodyText = sig && !body.includes(sig)
        ? `${body.trim()}\n\n— ${sig}`
        : body.trim();
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          category,
          title: title.trim(),
          body: bodyText,
          staffName: customerStore?.name || '',
          sendLinePush,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `送信失敗（${res.status}）`);
      }
      const j = await res.json();
      setResultMsg(j?.push?.pushed ? '送信完了（LINEプッシュあり）' : '保存完了（LINEプッシュ未送信）');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSending(false);
    }
  }

  async function sendLine() {
    if (!customerId || !title.trim() || !body.trim()) {
      setError('顧客・タイトル・本文すべて必要');
      return;
    }
    setSendingLine(true);
    setError(null);
    setResultMsg(null);
    try {
      const sig = customerStore?.signature?.trim() || '';
      const bodyText = sig && !body.includes(sig) ? `${body.trim()}\n\n— ${sig}` : body.trim();
      const res = await fetch('/api/admin/reports/send-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          title: title.trim(),
          body: bodyText,
          staffName: customerStore?.name || '',
          category: selectedTemplate?.category || 'アドバイス',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `LINE 送信失敗（${res.status}）`);
      }
      const j = await res.json();
      setResultMsg(j?.push?.pushed ? 'LINE 送信しました' : `失敗: ${j?.push?.reason || '不明'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSendingLine(false);
    }
  }

  return (
    <AdminShell title="レポート送付">
      <div className="space-y-3">
        {/* ① 顧客 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <label className="text-xs font-bold text-stone-700 mb-1 block">① 顧客</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">選択してください</option>
            {customers.map((c) => (
              <option key={c.pageId} value={c.pageId}>
                {c.name}
              </option>
            ))}
          </select>
        </section>

        {/* ② 期間（食事管理と同じ DateRangePicker・今日デフォルト） */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <div className="text-xs font-bold text-stone-700 mb-2">② 期間</div>
          <DateRangePicker
            from={from}
            to={to}
            today={today}
            onChangeFrom={setFrom}
            onChangeTo={setTo}
            onShift={shiftRange}
            isSingleDay={isSingleDay}
          />
        </section>

        {/* ③ 所属店舗（顧客から自動判定、レポート署名に使用） */}
        {customerStore && (
          <section className="bg-violet-50 border border-violet-200 rounded-2xl p-3">
            <div className="text-[11px] font-bold text-violet-800 mb-0.5">③ 送信元店舗（顧客の所属から自動）</div>
            <div className="text-sm font-bold text-violet-900">{customerStore.name}</div>
            {customerStore.signature && (
              <div className="text-[10px] text-violet-700 mt-1 italic">本文末尾に「— {customerStore.signature}」を自動付与</div>
            )}
          </section>
        )}
        {selectedCustomer && !customerStore && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <div className="text-[11px] font-bold text-amber-800">⚠ 顧客に所属店舗が設定されていません</div>
            <div className="text-[10px] text-amber-700 mt-0.5">レポート末尾の署名は自動付与されません。顧客詳細から店舗を設定してください。</div>
          </section>
        )}

        {/* ④ テンプレ（チップ形式で並べる・切替で本文が変わる） */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-stone-700 inline-flex items-center gap-2">
              ④ レポートテンプレート
              <Link
                href={isStore ? '/store/templates' : '/admin/templates'}
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100"
              >
                ⚙ レポートテンプレート管理
              </Link>
            </div>
            {selectedTemplate && (
              <span className="text-[10px] text-stone-500">
                {selectedTemplate.category}
                {selectedTemplate.useAi ? ' ・AI' : ''}
              </span>
            )}
          </div>

          {templateError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2 rounded-lg">
              {templateError}
            </div>
          )}
          {loading ? (
            <div className="text-[11px] text-stone-400 py-1">読み込み中…</div>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {[...templates]
                .sort((a, b) => {
                  const sa = a.sortOrder ?? 9999;
                  const sb = b.sortOrder ?? 9999;
                  if (sa !== sb) return sa - sb;
                  return a.name.localeCompare(b.name, 'ja');
                })
                .map((t) => (
                  <TemplateChip
                    key={t.id}
                    label={t.name}
                    useAi={t.useAi}
                    active={templateId === t.id}
                    onClick={() => setTemplateId(t.id)}
                  />
                ))}
              <TemplateChip
                label="テンプレなし"
                active={templateId === ''}
                onClick={() => setTemplateId('')}
              />
            </div>
          )}

          {/* タイトル */}
          <div className="pt-1">
            <label className="text-[10px] font-bold text-stone-700 block mb-1">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトルを入力"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 本文（ベーステキスト、最初から表示） */}
          <div>
            <label className="text-[10px] font-bold text-stone-700 block mb-1 inline-flex items-center gap-1">
              <FileText className="w-3 h-3" strokeWidth={2.4} />
              本文プレビュー（「レポート作成」で生成・編集可）
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="「レポート作成」を押すと変数・AI コメントが展開された本文が入ります"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y leading-relaxed"
            />
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generating || !customerId}
            className="w-full bg-emerald-500 text-white text-sm font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                文章を生成中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" strokeWidth={2.2} />
                文章を生成する
              </>
            )}
          </button>
        </section>

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}
        {resultMsg && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl inline-flex items-center gap-1">
            <Check className="w-4 h-4" strokeWidth={2.2} />
            {resultMsg}
          </div>
        )}

        {/* 送信 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={sendLinePush}
              onChange={(e) => setSendLinePush(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <span className="text-stone-700">LINE プッシュ通知も同時送信</span>
          </label>
          <button
            type="button"
            onClick={send}
            disabled={sending || !customerId || !title.trim() || !body.trim()}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" strokeWidth={2.2} />
            {sending ? '送信中…' : `${selectedCustomer?.name || '顧客'} 様に送信`}
          </button>
        </section>

      </div>
    </AdminShell>
  );
}

function TemplateChip({
  label,
  useAi = false,
  active,
  onClick,
}: {
  label: string;
  useAi?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-bold px-3 py-1.5 rounded-full border inline-flex items-center gap-1 ${
        active
          ? 'bg-emerald-500 text-white border-emerald-500'
          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
      }`}
    >
      {label}
      {useAi && (
        <Sparkles className={`w-3 h-3 ${active ? 'text-white' : 'text-emerald-600'}`} strokeWidth={2.4} />
      )}
    </button>
  );
}
