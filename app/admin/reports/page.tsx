'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  Sparkles,
  RefreshCw,
  FileText,
  Check,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import DateRangePicker from '../DateRangePicker';

type Customer = { pageId: string; name: string; foodStatus: string | null };
type Staff = { id: string; name: string; shop: string; role: string };
type Template = { id: string; name: string; category: string; titleTemplate: string; bodyTemplate: string; useAi: boolean; aiPrompt: string };

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
  const [from, setFrom] = useState<string>(addDaysStr(today, -1));
  const [to, setTo] = useState<string>(addDaysStr(today, -1));

  const [title, setTitle] = useState(initialDraft ? 'トレーナーからのレポート' : '');
  const [body, setBody] = useState(initialDraft);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendLinePush, setSendLinePush] = useState(true);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const startDate = from;
  const endDate = to;
  const isSingleDay = from === to;
  function shiftRange(delta: number) {
    setFrom(addDaysStr(from, delta));
    setTo(addDaysStr(to, delta));
  }

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

  // テンプレ選択時、カテゴリに応じて期間プリセット
  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    if (t.category === '週次レポート') {
      setFrom(addDaysStr(today, -6));
      setTo(today);
    } else if (t.category === '前日レポート') {
      const y = addDaysStr(today, -1);
      setFrom(y);
      setTo(y);
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

        {/* 日付（常時表示） */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <div className="text-xs font-bold text-stone-700 mb-2">③ 期間</div>
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

            {/* テンプレ切替（インライン） */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-2">
              <label className="text-[10px] font-bold text-stone-700 block">
                テンプレート（切替で AI が補正再生成）
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">テンプレなし</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.category}）{t.useAi ? ' [AI]' : ''}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="bg-white border border-stone-200 rounded-lg p-2 text-[11px] text-stone-700 leading-relaxed">
                  <div className="font-bold text-stone-800 mb-0.5">{selectedTemplate.name}</div>
                  {selectedTemplate.titleTemplate && (
                    <div className="text-[10px] text-stone-500">タイトル雛形: {selectedTemplate.titleTemplate}</div>
                  )}
                  {selectedTemplate.useAi ? (
                    <div className="mt-1 whitespace-pre-wrap break-words">
                      <span className="text-[10px] text-stone-500">AI指示:</span>{' '}
                      {selectedTemplate.aiPrompt || '（指示なし。標準で AI が分析）'}
                    </div>
                  ) : selectedTemplate.bodyTemplate ? (
                    <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-[11px]">{selectedTemplate.bodyTemplate}</pre>
                  ) : null}
                </div>
              )}
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="w-full bg-white border border-emerald-500 text-emerald-700 text-xs font-bold py-2 rounded-xl active:bg-emerald-50 disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} strokeWidth={2.2} />
                {generating ? '再生成中…' : 'テンプレで AI 再生成'}
              </button>
            </div>

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
                rows={14}
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
