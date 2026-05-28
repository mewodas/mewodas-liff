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
  Megaphone,
  AlertTriangle,
  Pin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import DateRangePicker from '../DateRangePicker';
import { useToast } from '@/components/Toast';

type Customer = { pageId: string; name: string; foodStatus: string | null; storeId: string | null };
type Store = { pageId: string; storeId: string; name: string; signature: string };
type Template = { id: string; name: string; category: string; titleTemplate: string; bodyTemplate: string; useAi: boolean; aiPrompt: string; rangeType?: string; sortOrder?: number };

type AnnouncementAudience = '顧客向け' | '店舗向け';
type AnnouncementImportance = '通常' | '重要';
type AnnouncementScope = 'all' | 'tenant';

type Announcement = {
  id: string;
  title: string;
  body: string;
  importance: AnnouncementImportance;
  audience: AnnouncementAudience;
  pinned: boolean;
  publishedAt: string | null;
  status: string;
  targetTenants: string[];
};

type Me = {
  role: 'master' | 'tenant_admin';
  currentTenantId: string;
  availableTenants: { id: string; name: string }[];
};

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
  const toast = useToast();
  const sp = useSearchParams();
  const pathname = usePathname() || '';
  const isStore = pathname.startsWith('/store');
  const modeParam = sp.get('mode');
  const [mode, setMode] = useState<'report' | 'announcement'>(modeParam === 'announcement' ? 'announcement' : 'report');

  // --- レポートモード state ---
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

  const templateBaselineRef = useRef<{ title: string; body: string }>({ title: '', body: initialDraft });

  // --- お知らせモード state ---
  const [me, setMe] = useState<Me | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [annConfigured, setAnnConfigured] = useState(true);
  const [audience, setAudience] = useState<AnnouncementAudience>('顧客向け');
  const [scope, setScope] = useState<AnnouncementScope>('all');
  const [targetTenantId, setTargetTenantId] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [importance, setImportance] = useState<AnnouncementImportance>('通常');
  const [pinned, setPinned] = useState(false);
  const [annSending, setAnnSending] = useState(false);
  const [annFormError, setAnnFormError] = useState<string | null>(null);

  const startDate = from;
  const endDate = to;
  const isSingleDay = from === to;
  function shiftRange(delta: number) {
    setFrom(addDaysStr(from, delta));
    setTo(addDaysStr(to, delta));
  }

  // レポートモード初期データロード
  useEffect(() => {
    (async () => {
      async function safeFetch<T>(url: string, fallback: T): Promise<T> {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) return fallback;
          const text = await res.text();
          if (!text) return fallback;
          try { return JSON.parse(text) as T; } catch { return fallback; }
        } catch { return fallback; }
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

  // お知らせモード初期データロード
  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setMe(j); })
      .catch(() => {});
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setAnnLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setAnnConfigured(j.configured !== false);
      setAnnouncements(j.announcements || []);
    } catch {
      // ignore
    } finally {
      setAnnLoading(false);
    }
  }

  const selectedCustomer = useMemo(() => customers.find((c) => c.pageId === customerId), [customers, customerId]);
  const customerStore = useMemo(() => {
    if (!selectedCustomer?.storeId) return null;
    return stores.find((s) => s.storeId === selectedCustomer.storeId) || null;
  }, [selectedCustomer, stores]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const isMaster = me?.role === 'master';
  const showAudienceSelect = !isStore && isMaster;
  const showScopeSelect = !isStore && isMaster && audience === '顧客向け';
  const showTenantSelect = showScopeSelect && scope === 'tenant';

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
      if (j?.push?.pushed) {
        setResultMsg('送信完了（LINEプッシュあり）');
        toast.success('送信しました');
      } else {
        setResultMsg('保存完了（LINEプッシュ未送信）');
        toast.success('保存しました');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '送信に失敗しました');
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
      if (j?.push?.pushed) {
        setResultMsg('LINE 送信しました');
        toast.success('送信しました');
      } else {
        setResultMsg(`失敗: ${j?.push?.reason || '不明'}`);
        toast.error(`LINE 送信失敗: ${j?.push?.reason || '不明'}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : 'LINE 送信に失敗しました');
    } finally {
      setSendingLine(false);
    }
  }

  async function submitAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) {
      setAnnFormError('タイトルと本文は必須です');
      return;
    }
    setAnnSending(true);
    setAnnFormError(null);
    try {
      const payload: Record<string, unknown> = {
        title: annTitle.trim(),
        body: annBody.trim(),
        importance,
        pinned,
      };
      if (!isStore) {
        payload.audience = audience;
        payload.scope = scope;
        if (isMaster && scope === 'tenant' && targetTenantId) {
          payload.targetTenantId = targetTenantId;
        }
      }
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setAnnFormError(j.error || '送信に失敗しました');
        toast.error(j.error || '送信に失敗しました');
        return;
      }
      toast.success('お知らせを送信しました');
      setAnnTitle('');
      setAnnBody('');
      setPinned(false);
      setImportance('通常');
      setScope('all');
      setTargetTenantId('');
      setAudience('顧客向け');
      await loadAnnouncements();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '送信に失敗しました';
      setAnnFormError(msg);
      toast.error(msg);
    } finally {
      setAnnSending(false);
    }
  }

  return (
    <AdminShell title="レポート送付">
      <div className="space-y-3">
        {/* モードトグル */}
        <div className="flex gap-1.5 bg-stone-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setMode('report')}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
              mode === 'report'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={2.2} />
            レポート
          </button>
          <button
            type="button"
            onClick={() => setMode('announcement')}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
              mode === 'announcement'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" strokeWidth={2.2} />
            お知らせ
          </button>
        </div>

        {/* ===== レポートモード ===== */}
        {mode === 'report' && (
          <>
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
                  <option key={c.pageId} value={c.pageId}>{c.name}</option>
                ))}
              </select>
            </section>

            {/* ② 期間 */}
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

            {/* ③ 所属店舗 */}
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

            {/* ④ テンプレ */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-stone-700 inline-flex items-center gap-2">
                  ④ レポートテンプレート
                  <Link
                    href={isStore ? '/store/templates' : '/admin/templates'}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100"
                  >
                    ⚙ テンプレ管理
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
                  <TemplateChip label="テンプレなし" active={templateId === ''} onClick={() => setTemplateId('')} />
                </div>
              )}

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
              {sendingLine !== undefined && (
                <button
                  type="button"
                  onClick={sendLine}
                  disabled={sendingLine || !customerId || !title.trim() || !body.trim()}
                  className="hidden w-full bg-[#06C755] text-white font-bold py-3 rounded-xl disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={2.2} />
                  {sendingLine ? 'LINE送信中…' : 'LINE のみ送信'}
                </button>
              )}
            </section>
          </>
        )}

        {/* ===== お知らせモード ===== */}
        {mode === 'announcement' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">
              <span className="font-bold">アプリ内お知らせのみ送信されます。</span>
              LINE 通知は送られません（顧客がアプリを開いた際に表示されます）。
            </div>

            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
                <Megaphone className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                新しいお知らせを作成
              </div>

              {showAudienceSelect && (
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">宛先種別</label>
                  <div className="flex gap-2">
                    {(['顧客向け', '店舗向け'] as AnnouncementAudience[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAudience(a)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                          audience === a
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showScopeSelect && (
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">対象店舗</label>
                  <div className="flex gap-2 mb-2">
                    {([['all', '全店舗'], ['tenant', '特定店舗']] as [AnnouncementScope, string][]).map(([s, label]) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScope(s)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                          scope === s
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {showTenantSelect && (
                    <select
                      value={targetTenantId}
                      onChange={(e) => setTargetTenantId(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">テナントを選択</option>
                      {(me?.availableTenants || []).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {isStore && (
                <div className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
                  自店舗の全顧客に一斉送信されます
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-stone-700 block mb-1">タイトル</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="例：営業時間変更のお知らせ"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-700 block mb-1">本文</label>
                <textarea
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  rows={6}
                  placeholder="お知らせの内容を入力してください"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">重要度</label>
                  <div className="flex gap-2">
                    {(['通常', '重要'] as AnnouncementImportance[]).map((imp) => (
                      <button
                        key={imp}
                        type="button"
                        onClick={() => setImportance(imp)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border inline-flex items-center gap-1 ${
                          importance === imp
                            ? imp === '重要'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {imp === '重要' && <AlertTriangle className="w-3 h-3" strokeWidth={2.4} />}
                        {imp}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <Pin className="w-3.5 h-3.5 text-stone-500" strokeWidth={2.2} />
                  ピン留め
                </label>
              </div>

              {annFormError && (
                <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">
                  {annFormError}
                </div>
              )}

              <button
                type="button"
                onClick={submitAnnouncement}
                disabled={annSending || !annTitle.trim() || !annBody.trim()}
                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" strokeWidth={2.2} />
                {annSending ? '送信中…' : 'お知らせを送信'}
              </button>
            </section>

            {/* 送信履歴 */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
              <div className="text-sm font-bold text-stone-800 mb-3">送信履歴</div>
              {!annConfigured && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  NOTION_ANNOUNCEMENTS_DB_ID が未設定です。お知らせDBを作成して環境変数を設定してください。
                </div>
              )}
              {annConfigured && annLoading && (
                <div className="text-xs text-stone-400 py-2">読み込み中…</div>
              )}
              {annConfigured && !annLoading && announcements.length === 0 && (
                <div className="text-xs text-stone-400 py-2">送信履歴はありません</div>
              )}
              {annConfigured && !annLoading && announcements.length > 0 && (
                <div className="space-y-2">
                  {announcements.map((a) => (
                    <AnnouncementRow key={a.id} announcement={a} isStore={isStore} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
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

function AnnouncementRow({ announcement: a, isStore }: { announcement: Announcement; isStore: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50"
      >
        {a.pinned && <Pin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />}
        {a.importance === '重要' && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" strokeWidth={2.2} />
        )}
        <span className="text-xs font-bold text-stone-800 flex-1 truncate">{a.title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isStore && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                a.audience === '店舗向け'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {a.audience}
            </span>
          )}
          {a.targetTenants.length > 0 && (
            <span className="text-[10px] text-stone-500">{a.targetTenants.join(', ')}</span>
          )}
          <span className="text-[10px] text-stone-400">{a.publishedAt || '—'}</span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-stone-400" strokeWidth={2.2} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" strokeWidth={2.2} />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-stone-100 px-3 py-2.5 bg-stone-50">
          <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">{a.body}</p>
          <div className="flex gap-2 mt-2">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                a.status === '公開'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : a.status === '下書き'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
              }`}
            >
              {a.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
