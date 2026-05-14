'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  Sparkles,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Users,
  Check,
} from 'lucide-react';
import AdminShell from '../AdminShell';

type Customer = { pageId: string; name: string; foodStatus: string | null };
type Staff = { id: string; name: string; shop: string; role: string };
type Template = { id: string; name: string; category: string; titleTemplate: string; bodyTemplate: string; useAi: boolean };

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
function fmtMd(s: string): string {
  const [, m, d] = s.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
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
  const initialCustomerId = sp.get('customerId') || '';
  const initialDraft = sp.get('draft') || '';
  const today = jstToday();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [staffId, setStaffId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [rangeMode, setRangeMode] = useState<boolean>(false);
  const [singleDate, setSingleDate] = useState<string>(today);
  const [from, setFrom] = useState<string>(addDaysStr(today, -6));
  const [to, setTo] = useState<string>(today);

  const [title, setTitle] = useState(initialDraft ? 'トレーナーからのレポート' : '');
  const [body, setBody] = useState(initialDraft);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendLinePush, setSendLinePush] = useState(true);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const startDate = rangeMode ? from : singleDate;
  const endDate = rangeMode ? to : singleDate;

  useEffect(() => {
    (async () => {
      try {
        const [cRes, sRes, tRes] = await Promise.all([
          fetch('/api/admin/customers', { cache: 'no-store' }),
          fetch('/api/admin/staff', { cache: 'no-store' }),
          fetch('/api/admin/templates', { cache: 'no-store' }),
        ]);
        const [cJ, sJ, tJ] = await Promise.all([cRes.json(), sRes.json(), tRes.json()]);
        setCustomers((cJ.customers || []).filter((c: Customer) => !!c.foodStatus));
        setStaffList(sJ.staff || []);
        setTemplates(tJ.templates || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // テンプレ選択時、カテゴリに応じて日付モード調整
  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    if (t.category === '週次レポート') {
      setRangeMode(true);
      setFrom(addDaysStr(today, -6));
      setTo(today);
    } else if (t.category === '前日レポート') {
      setRangeMode(false);
      setSingleDate(addDaysStr(today, -1));
    }
  }, [templateId, templates, today]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.pageId === customerId), [customers, customerId]);
  const selectedStaff = useMemo(() => staffList.find((s) => s.id === staffId), [staffList, staffId]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

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
          staffId: staffId || undefined,
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
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          category,
          title: title.trim(),
          body: body.trim(),
          staffName: selectedStaff?.name || '',
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

  return (
    <AdminShell title="レポート送付">
      <div className="space-y-3">
        {/* 設定リンク */}
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/templates"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-700 bg-white border border-stone-300 px-3 py-1.5 rounded-full hover:bg-stone-50"
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={2.2} />
            テンプレ管理
          </Link>
          <Link
            href="/admin/staff"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-700 bg-white border border-stone-300 px-3 py-1.5 rounded-full hover:bg-stone-50"
          >
            <Users className="w-3.5 h-3.5" strokeWidth={2.2} />
            スタッフ管理
          </Link>
        </div>

        {/* 顧客選択 */}
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

        {/* テンプレ選択 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <label className="text-xs font-bold text-stone-700 mb-1 block">② テンプレ</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">テンプレなし（AI 標準分析）</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.category}）{t.useAi ? ' [AI]' : ''}
              </option>
            ))}
          </select>
        </section>

        {/* 日付 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <div className="text-xs font-bold text-stone-700 mb-1">③ 期間</div>
          {!rangeMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSingleDate(addDaysStr(singleDate, -1))}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700"
                aria-label="前日"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
              </button>
              <div className="flex-1 text-center">
                <div className="text-base font-bold text-stone-900">{fmtMd(singleDate)}</div>
                <div className="text-[10px] text-stone-500">{singleDate}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (singleDate < today) setSingleDate(addDaysStr(singleDate, 1));
                }}
                disabled={singleDate >= today}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 disabled:opacity-30"
                aria-label="翌日"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700"
                  aria-label="カレンダー"
                >
                  <CalendarIcon className="w-4 h-4" strokeWidth={2.2} />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={singleDate}
                  max={today}
                  onChange={(e) => e.target.value && setSingleDate(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-none"
                  tabIndex={-1}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-stone-600 flex-shrink-0" strokeWidth={2.2} />
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-stone-500">〜</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (rangeMode) {
                  setRangeMode(false);
                  setSingleDate(today);
                } else {
                  setSingleDate(today);
                }
              }}
              className="text-[11px] font-bold px-3 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => {
                setRangeMode((v) => !v);
                if (!rangeMode) {
                  setFrom(addDaysStr(today, -6));
                  setTo(today);
                } else {
                  setSingleDate(today);
                }
              }}
              className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                rangeMode ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-stone-700 border-stone-300'
              }`}
            >
              {rangeMode ? '単日に戻す' : '期間で絞る'}
            </button>
          </div>
        </section>

        {/* スタッフ */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <label className="text-xs font-bold text-stone-700 mb-1 block">④ 送信者（スタッフ）</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">指定しない</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.shop ? `（${s.shop}）` : ''}
              </option>
            ))}
          </select>
        </section>

        {/* レポート作成 */}
        <button
          type="button"
          onClick={generate}
          disabled={generating || !customerId}
          className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
              生成中…（10〜20秒）
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" strokeWidth={2.2} />
              レポート作成
            </>
          )}
        </button>

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}
        {resultMsg && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl inline-flex items-center gap-1">
            <Check className="w-4 h-4" strokeWidth={2.2} />
            {resultMsg}
          </div>
        )}

        {/* プレビュー&編集 */}
        {(title || body) && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-3">
            <div className="text-xs font-bold text-stone-700">⑤ 内容を確認・編集</div>
            <div>
              <label className="text-[10px] font-bold text-stone-700 block mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-stone-700 block mb-1">本文</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y leading-relaxed"
              />
            </div>
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
              {sending ? '送信中…' : `${selectedCustomer?.name || '顧客'} に送信`}
            </button>
          </section>
        )}

        {loading && <div className="text-center text-stone-500 py-6">読み込み中…</div>}
      </div>
    </AdminShell>
  );
}
