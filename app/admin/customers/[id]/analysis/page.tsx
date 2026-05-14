'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ThumbsUp, AlertTriangle, Lightbulb, Send, FileText, RefreshCw, Activity } from 'lucide-react';
import AdminShell from '../../../AdminShell';

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

const RANGES = [7, 14, 30] as const;

export default function CustomerAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [days, setDays] = useState<number>(30);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(targetDays: number) {
    setLoading(true);
    setError(null);
    setMessage(null);
    setAnalysis(null);
    setStats(null);
    try {
      const res = await fetch(`/api/admin/customers/${id}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: targetDays }),
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
    <AdminShell title="AI 分析・提案" back={{ href: `/admin/customers/${id}` }}>
      <div className="space-y-4">
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-stone-700 mb-2 block">分析期間</label>
            <div className="flex gap-2">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setDays(r);
                  }}
                  className={`flex-1 text-sm font-bold px-3 py-2 rounded-xl border ${
                    days === r
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  直近{r}日
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => run(days)}
            disabled={loading}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
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
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
          )}
          {message && (
            <div className="bg-amber-100 border border-amber-300 text-amber-900 text-xs p-2 rounded-xl">{message}</div>
          )}
        </section>

        {stats && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
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
              <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                {analysis.summary}
              </p>
            </Section>

            {analysis.strengths.length > 0 && (
              <Section
                title="強み"
                icon={<ThumbsUp className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />}
              >
                <Bullets items={analysis.strengths} />
              </Section>
            )}
            {analysis.concerns.length > 0 && (
              <Section
                title="懸念点"
                icon={<AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={2.2} />}
              >
                <Bullets items={analysis.concerns} />
              </Section>
            )}
            {analysis.patterns.length > 0 && (
              <Section
                title="パターン"
                icon={<Activity className="w-4 h-4 text-sky-600" strokeWidth={2.2} />}
              >
                <Bullets items={analysis.patterns} />
              </Section>
            )}
            {analysis.recommendations.length > 0 && (
              <Section
                title="提案"
                icon={<Lightbulb className="w-4 h-4 text-amber-500" strokeWidth={2.2} />}
              >
                <Bullets items={analysis.recommendations} />
              </Section>
            )}

            {analysis.reportDraft && (
              <Section
                title="顧客送信用ドラフト"
                icon={<FileText className="w-4 h-4 text-stone-600" strokeWidth={2.2} />}
              >
                <pre className="text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed font-sans">
                  {analysis.reportDraft}
                </pre>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Link
                    href={`/admin/customers/${id}/notifications?draft=${encodeURIComponent(analysis.reportDraft)}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl active:bg-emerald-700"
                  >
                    <Send className="w-4 h-4" strokeWidth={2.2} />
                    このドラフトで送信ページを開く
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(analysis.reportDraft)}
                    className="inline-flex items-center justify-center bg-white border border-stone-300 text-stone-700 text-sm font-bold px-3 py-2 rounded-xl active:bg-stone-50"
                  >
                    コピー
                  </button>
                </div>
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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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
