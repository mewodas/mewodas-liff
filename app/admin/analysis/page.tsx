'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  RefreshCw,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Activity,
  FileText,
  Send,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import DateRangePicker from '../DateRangePicker';

type Customer = { pageId: string; name: string; foodStatus: string | null };

type Analysis = {
  summary: string;
  strengths: string[];
  concerns: string[];
  patterns: string[];
  recommendations: string[];
  reportDraft: string;
};

type Stats = {
  totalDays: number;
  avg: { kcal: number; P: number; F: number; C: number };
  sum: { kcal: number; P: number; F: number; C: number };
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
function diffDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

export default function AdminAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-stone-500">読み込み中…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const initialCustomerId = sp.get('customerId') || '';
  const today = jstToday();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [from, setFrom] = useState<string>(addDaysStr(today, -29));
  const [to, setTo] = useState<string>(today);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        setCustomers((j.customers || []).filter((c: Customer) => !!c.foodStatus));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  const startDate = from;
  const endDate = to;
  const isSingleDay = from === to;
  const periodDays = useMemo(() => diffDays(startDate, endDate), [startDate, endDate]);

  function shiftRange(delta: number) {
    setFrom(addDaysStr(from, delta));
    setTo(addDaysStr(to, delta));
  }

  async function run() {
    if (!customerId) {
      setError('顧客を選択してください');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setAnalysis(null);
    setStats(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: periodDays }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `分析失敗（${res.status}）`);
      }
      const j = await res.json();
      setAnalysis(j.analysis);
      setStats(j.stats);
      setRangeLabel(j.rangeLabel || '');
      if (j.message) setMessage(j.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell title="AI 分析">
      <div className="space-y-3">
        {/* 顧客選択 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <label className="text-xs font-bold text-stone-700 mb-1 block">顧客</label>
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
          {loadingCustomers && <div className="text-[11px] text-stone-500 mt-1">顧客読み込み中…</div>}
        </section>

        {/* 日付（常時表示） */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
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

        <button
          type="button"
          onClick={run}
          disabled={loading || !customerId}
          className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
              分析中…（10〜20秒）
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" strokeWidth={2.2} />
              AI で分析する
            </>
          )}
        </button>

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}
        {message && <div className="bg-amber-100 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl">{message}</div>}

        {stats && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
            <div className="text-[11px] text-stone-500 mb-1">{rangeLabel}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="記録日数" value={`${stats.totalDays}`} unit="日" />
              <Stat label="平均カロリー" value={`${stats.avg.kcal}`} unit="kcal" />
              <Stat label="平均P" value={`${stats.avg.P}`} unit="g" />
              <Stat label="平均F" value={`${stats.avg.F}`} unit="g" />
            </div>
          </section>
        )}

        {analysis && (
          <>
            <Section title="総評" icon={<Activity className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />}>
              <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{analysis.summary}</p>
            </Section>
            {analysis.strengths.length > 0 && (
              <Section title="強み" icon={<ThumbsUp className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />}>
                <Bullets items={analysis.strengths} />
              </Section>
            )}
            {analysis.concerns.length > 0 && (
              <Section title="懸念点" icon={<AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={2.2} />}>
                <Bullets items={analysis.concerns} />
              </Section>
            )}
            {analysis.patterns.length > 0 && (
              <Section title="パターン" icon={<Activity className="w-4 h-4 text-sky-600" strokeWidth={2.2} />}>
                <Bullets items={analysis.patterns} />
              </Section>
            )}
            {analysis.recommendations.length > 0 && (
              <Section title="提案" icon={<Lightbulb className="w-4 h-4 text-amber-500" strokeWidth={2.2} />}>
                <Bullets items={analysis.recommendations} />
              </Section>
            )}
            {analysis.reportDraft && (
              <Section title="顧客送信用ドラフト" icon={<FileText className="w-4 h-4 text-stone-600" strokeWidth={2.2} />}>
                <pre className="text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed font-sans">
                  {analysis.reportDraft}
                </pre>
                {customerId && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Link
                      href={`/admin/reports?customerId=${customerId}&draft=${encodeURIComponent(analysis.reportDraft)}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl active:bg-emerald-700"
                    >
                      <Send className="w-4 h-4" strokeWidth={2.2} />
                      レポート送付ページへ
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(analysis.reportDraft)}
                      className="inline-flex items-center justify-center gap-1 bg-white border border-stone-300 text-stone-700 text-sm font-bold px-3 py-2 rounded-xl active:bg-stone-50"
                    >
                      コピー
                    </button>
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-2">
      <div className="text-[10px] font-bold text-stone-600">{label}</div>
      <div className="text-sm font-bold text-stone-900 mt-0.5">
        {value}
        <span className="text-[10px] font-medium text-stone-500 ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
      <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 mb-2">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="text-sm text-stone-800 leading-relaxed flex gap-2">
          <span className="text-stone-400 flex-shrink-0">・</span>
          <span className="whitespace-pre-wrap break-words">{s}</span>
        </li>
      ))}
    </ul>
  );
}
