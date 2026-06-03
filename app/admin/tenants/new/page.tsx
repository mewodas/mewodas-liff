'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Rocket, RefreshCw, ExternalLink, Copy, Check, Building2, Mail } from 'lucide-react';
import AdminShell from '../../AdminShell';
import { useToast } from '@/components/Toast';

const PLANS = ['5-10名', '11-20名', '21名+', 'モニター', '無料'] as const;

type ProvisionResult = {
  tenantId: string;
  customerDbId: string;
  foodDbId: string;
  customerDbUrl: string;
  foodDbUrl: string;
  mail?: { sent: boolean; reason?: string; error?: string };
  initialPassword?: string;
};

export default function NewTenantPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<string>('5-10名');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function submit() {
    if (!name || !plan || !ownerEmail) {
      setError('全項目入力してください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, plan, ownerEmail, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `作成失敗（${res.status}）`);
      setResult(j);
      toast.success('テナントを作成しました');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : 'テナントの作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <AdminShell title="新規テナント作成" back={{ href: '/admin/tenants' }}>
      <div className="space-y-3">
        {!result ? (
          <>
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
                <h2 className="text-sm font-bold text-stone-900">ジム情報</h2>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">ジム名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: ライザップ五反田店"
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">プラン</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">オーナーメール</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">備考（任意）</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="紹介経路・特記事項など"
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                />
              </div>
            </section>

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
              ⚠️ 「作成」を押すと Notion に <b>顧客DB</b> と <b>食事記録DB</b> が自動生成されます。後戻りには手動削除が必要なのでジム名は慎重に。
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !name || !plan || !ownerEmail}
              className="w-full bg-violet-500 text-white font-bold py-3 rounded-xl active:bg-violet-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                  作成中…（10〜20秒）
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" strokeWidth={2.4} />
                  テナント作成
                </>
              )}
            </button>
          </>
        ) : (
          <section className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-4 space-y-4">
            <div className="text-center">
              <div className="text-3xl">🎉</div>
              <h2 className="text-base font-bold text-emerald-700 mt-1">{name} テナント作成完了</h2>
            </div>

            <div className="space-y-2">
              <ResultRow label="tenant_id" value={result.tenantId} onCopy={(v) => copyToClipboard(v, 'tid')} copied={copied === 'tid'} />
              <ResultRow label="顧客 DB ID" value={result.customerDbId} onCopy={(v) => copyToClipboard(v, 'cdb')} copied={copied === 'cdb'} />
              <ResultRow label="食事 DB ID" value={result.foodDbId} onCopy={(v) => copyToClipboard(v, 'fdb')} copied={copied === 'fdb'} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={result.customerDbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50 inline-flex items-center justify-center gap-1"
              >
                顧客DB を開く <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
              </a>
              <a
                href={result.foodDbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50 inline-flex items-center justify-center gap-1"
              >
                食事DB を開く <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
              </a>
            </div>

            {/* メール送信結果 */}
            {result.mail?.sent && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-[11px] text-emerald-800 inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" strokeWidth={2.4} />
                <span><b>初期パスワードをメール送信済み</b>（→ {ownerEmail}）</span>
              </div>
            )}
            {result.mail && !result.mail.sent && result.initialPassword && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] text-amber-900 space-y-2">
                <div className="font-bold inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" strokeWidth={2.4} />
                  メール自動送信に失敗（{result.mail.reason === 'no_provider' ? 'RESEND未設定' : result.mail.error}）
                </div>
                <div>下記情報を手動でジムオーナーに伝えてください：</div>
                <div className="bg-white border border-amber-300 rounded-lg p-2 space-y-1 text-[11px]">
                  <div><span className="text-stone-600">URL:</span> <code>https://app.fitmeal.jp/store/login</code></div>
                  <div><span className="text-stone-600">メール:</span> <code>{ownerEmail}</code></div>
                  <div><span className="text-stone-600">パスワード:</span> <code className="font-mono font-bold">{result.initialPassword}</code></div>
                </div>
              </div>
            )}

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-[11px] text-stone-700 space-y-1">
              <div className="font-bold">📋 次にやること</div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>ジムオーナー（{ownerEmail}）に LIFF 設定マニュアル送付</li>
                <li>ジムから LIFF ID 受領後、テナント一覧から該当行を編集して登録</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <Link
                href="/admin/tenants"
                className="flex-1 text-center bg-violet-500 text-white font-bold py-2.5 rounded-xl active:bg-violet-700 text-sm"
              >
                テナント一覧へ
              </Link>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setName('');
                  setPlan('5-10名');
                  setOwnerEmail('');
                  setNote('');
                }}
                className="flex-1 text-center bg-white border border-stone-300 text-stone-700 font-bold py-2.5 rounded-xl active:bg-stone-50 text-sm"
              >
                もう1件作成
              </button>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function ResultRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: boolean;
}) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 flex items-center gap-2">
      <div className="text-[10px] font-bold text-stone-600 w-20 flex-shrink-0">{label}</div>
      <code className="text-[11px] text-stone-900 flex-1 truncate font-mono">{value}</code>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className="text-stone-500 hover:text-stone-900 flex-shrink-0"
        aria-label="コピー"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.4} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />}
      </button>
    </div>
  );
}
