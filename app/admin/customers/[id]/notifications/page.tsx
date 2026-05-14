'use client';

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, FileText, Check, X, Bell, AlertTriangle, Sparkles } from 'lucide-react';
import AdminShell from '../../../AdminShell';

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
};

type Notification = {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

const CATEGORIES: { label: string; value: '前日レポート' | '週次レポート' | 'お知らせ' | 'アドバイス' }[] = [
  { label: '前日レポート', value: '前日レポート' },
  { label: '週次レポート', value: '週次レポート' },
  { label: 'アドバイス', value: 'アドバイス' },
  { label: 'お知らせ', value: 'お知らせ' },
];

const TEMPLATES: Record<string, { title: string; body: string }> = {
  前日レポート: {
    title: '前日の振り返りレポート',
    body: '昨日の食事・運動を振り返ります。\n\n【良かった点】\n- \n\n【改善点】\n- \n\n【今日のアドバイス】\n- ',
  },
  週次レポート: {
    title: '週次レポート',
    body: '今週もお疲れさまでした！1週間の振り返りです。\n\n【今週のハイライト】\n- \n\n【課題】\n- \n\n【来週に向けて】\n- ',
  },
  アドバイス: {
    title: 'トレーナーからのアドバイス',
    body: 'こんにちは。\n\n',
  },
  お知らせ: {
    title: 'お知らせ',
    body: '',
  },
};

export default function CustomerNotificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-center text-stone-500">読み込み中…</div>}>
      <Inner params={params} />
    </Suspense>
  );
}

function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sp = useSearchParams();
  const initialDraft = sp.get('draft');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Notification[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<'前日レポート' | '週次レポート' | 'お知らせ' | 'アドバイス'>(
    initialDraft ? 'アドバイス' : '前日レポート'
  );
  const [title, setTitle] = useState<string>(
    initialDraft ? 'トレーナーからのレポート' : TEMPLATES['前日レポート'].title
  );
  const [body, setBody] = useState<string>(initialDraft || TEMPLATES['前日レポート'].body);
  const [sendLinePush, setSendLinePush] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${id}/notifications`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setConfigured(!!j.configured);
        setHistory(j.notifications || []);
        if (j.customer) setCustomer(j.customer);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function applyTemplate(c: '前日レポート' | '週次レポート' | 'お知らせ' | 'アドバイス') {
    setCategory(c);
    const t = TEMPLATES[c];
    setTitle(t.title);
    setBody(t.body);
  }

  async function send() {
    setSubmitting(true);
    setError(null);
    setResultMsg(null);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: id,
          category,
          title: title.trim(),
          body: body.trim(),
          sendLinePush,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `送信失敗（${res.status}）`);
      }
      const j = await res.json();
      const pushed = j?.push?.pushed;
      setResultMsg(pushed ? '送信完了（LINE プッシュ送信あり）' : '保存完了（LINE プッシュは未設定/スキップ）');
      // 履歴再取得
      const hres = await fetch(`/api/admin/customers/${id}/notifications`, { cache: 'no-store' });
      if (hres.ok) {
        const hj = await hres.json();
        setHistory(hj.notifications || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSubmitting(false);
    }
  }

  const charCount = useMemo(() => body.length, [body]);

  return (
    <AdminShell title={customer?.name ? `${customer.name} へ送信` : 'レポート/通知'} back={{ href: `/admin/customers/${id}` }}>
      <div className="space-y-4">
        {!configured && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
            <div>
              <div className="font-bold mb-1">通知DB が未設定です</div>
              <p className="leading-relaxed">
                Notion で通知用 DB を作成し、環境変数 <code className="font-mono bg-amber-100 px-1 rounded">NOTION_NOTIFICATIONS_DB_ID</code> をセットしてください。
              </p>
              <p className="text-[10px] mt-1 leading-relaxed">
                スキーマ例：タイトル(title) / LINEユーザーID(rich_text) / 顧客名(rich_text) / カテゴリ(select) / 本文(rich_text) / 既読(checkbox) / 既読日時(date)
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}
        {resultMsg && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4" strokeWidth={2.2} />
            {resultMsg}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <Send className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            新規送信
          </h2>

          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">テンプレ</label>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => applyTemplate(c.value)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    category === c.value
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block flex items-center justify-between">
              <span>本文</span>
              <span className="text-[10px] text-stone-500 font-normal">{charCount}文字</span>
            </label>
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
            <span className="text-[10px] text-stone-500">（LINE_CHANNEL_ACCESS_TOKEN 設定時のみ実際に届く）</span>
          </label>

          <button
            type="button"
            onClick={send}
            disabled={submitting || !configured || !title.trim() || !body.trim()}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 inline-flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" strokeWidth={2.2} />
            {submitting ? '送信中…' : '送信する'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
            <h2 className="text-sm font-bold text-stone-900">送信履歴</h2>
            <span className="text-[11px] text-stone-500 ml-auto">{history.length}件</span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-stone-500">読み込み中…</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-sm">まだ送信履歴がありません</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {history.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300">
                      {iconForCategory(n.category)}
                      {n.category}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      {new Date(n.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </span>
                    <span
                      className={`ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        n.read
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {n.read ? <Check className="w-3 h-3" strokeWidth={2.4} /> : <X className="w-3 h-3" strokeWidth={2.4} />}
                      {n.read ? '既読' : '未読'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-stone-900">{n.title}</div>
                  <div className="text-xs text-stone-700 mt-1 whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
                    {n.body}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function iconForCategory(c: string) {
  if (c === '前日レポート' || c === '週次レポート') return <FileText className="w-3 h-3" strokeWidth={2.2} />;
  if (c === 'アドバイス') return <Sparkles className="w-3 h-3" strokeWidth={2.2} />;
  return <Bell className="w-3 h-3" strokeWidth={2.2} />;
}
