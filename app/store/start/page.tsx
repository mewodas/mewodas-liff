'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Copy,
  ExternalLink,
  QrCode,
  Link2,
  Rocket,
  Users,
  UtensilsCrossed,
  ChevronRight,
  Share2,
  PartyPopper,
} from 'lucide-react';
import AdminShell from '@/app/admin/AdminShell';
import { useToast } from '@/components/Toast';

type ActivationState = {
  gymName: string;
  tenantId: string;
  liffConnected: boolean;
  onboardingCompleted: boolean;
  inviteUrl: string | null;
  customerCount: number;
  hasFirstRecord: boolean;
};

function CopyButton({ value, label = 'コピー' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 shrink-0"
    >
      <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />
      {copied ? 'コピー済み' : label}
    </button>
  );
}

export default function StoreStartPage() {
  const toast = useToast();
  const [state, setState] = useState<ActivationState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/store/activation', { cache: 'no-store' });
      if (!res.ok) throw new Error('読み込みに失敗しました');
      setState((await res.json()) as ActivationState);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AdminShell title="スタートガイド">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" strokeWidth={2} />
        </div>
      </AdminShell>
    );
  }

  const connected = !!state?.liffConnected || !!state?.onboardingCompleted;
  const hasCustomer = (state?.customerCount ?? 0) > 0;
  const hasRecord = !!state?.hasFirstRecord;
  const inviteUrl = state?.inviteUrl ?? null;

  const steps = [
    {
      key: 'connect',
      done: connected,
      Icon: Link2,
      title: 'LINE公式アカウントと連携する',
      desc: 'お客様がアプリを使えるよう、LINE公式アカウントを FitMeal に接続します。',
      href: '/store/onboarding',
      cta: connected ? '連携設定を確認' : '連携をはじめる',
    },
    {
      key: 'invite',
      done: hasCustomer,
      Icon: Users,
      title: 'お客様を招待して登録してもらう',
      desc: hasCustomer
        ? `現在 ${state?.customerCount} 名のお客様が登録済みです。`
        : '友だち追加リンク・QRコードをお客様に共有しましょう。下の「お客様を招待」から。',
      href: '#invite',
      cta: hasCustomer ? '顧客一覧を見る' : '招待リンクを見る',
      hrefIfDone: '/store/customers',
    },
    {
      key: 'record',
      done: hasRecord,
      Icon: UtensilsCrossed,
      title: '最初の食事記録が入る',
      desc: hasRecord
        ? 'お客様の記録が届いています。レポートや分析で活用しましょう。'
        : 'お客様がアプリで食事を記録すると、ここに反映されます。',
      href: '/store/customers',
      cta: '顧客の記録を見る',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <AdminShell title="スタートガイド">
      <div className="space-y-4 max-w-2xl">
        {/* ヘッダー / 進捗 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              {allDone ? (
                <PartyPopper className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
              ) : (
                <Rocket className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-stone-900">
                {allDone ? '立ち上げ完了！' : `${state?.gymName ?? ''} のセットアップ`}
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {allDone
                  ? 'お客様の食事管理を運用していきましょう。お客様を増やす時はいつでもこの画面の招待リンクが使えます。'
                  : 'お客様が食事管理を使い始めるまで、あと少しです。'}
              </p>
            </div>
          </div>

          {/* 進捗バー */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-stone-500">セットアップ進捗</span>
              <span className="text-emerald-700">{doneCount} / {steps.length}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </section>

        {/* チェックリスト */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
          {steps.map((s) => {
            const href = s.done && s.hrefIfDone ? s.hrefIfDone : s.href;
            const isAnchor = href.startsWith('#');
            const inner = (
              <div className="flex items-start gap-3 p-4 hover:bg-stone-50 transition-colors">
                <div className="shrink-0 mt-0.5">
                  {s.done ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={2.2} />
                  ) : (
                    <Circle className="w-6 h-6 text-stone-300" strokeWidth={2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${s.done ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-900'}`}>
                    {s.title}
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">{s.desc}</div>
                </div>
                {!s.done && (
                  <div className="shrink-0 self-center inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    {s.cta}
                    <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
                  </div>
                )}
              </div>
            );
            return isAnchor ? (
              <a key={s.key} href={href} className="block">{inner}</a>
            ) : (
              <Link key={s.key} href={href} className="block">{inner}</Link>
            );
          })}
        </section>

        {/* お客様を招待 */}
        <section id="invite" className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4 scroll-mt-20">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            お客様を招待
          </h2>

          {!connected || !inviteUrl ? (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl">
                LINE公式アカウントとの連携が完了すると、お客様用の友だち追加リンクとQRコードがここに表示されます。
              </div>
              <Link
                href="/store/onboarding"
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl active:bg-emerald-800 inline-flex items-center justify-center gap-2 text-sm"
              >
                <Rocket className="w-4 h-4" strokeWidth={2.2} />
                LINE連携をはじめる
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-stone-600">
                下のリンク・QRコードをお客様に共有してください。お客様は <strong>LINE公式アカウントを友だち追加</strong> →
                アプリ内の案内に沿って登録するだけで、食事記録を始められます。
              </p>

              {/* 招待URL */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-stone-700">友だち追加リンク</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs break-all">
                    {inviteUrl}
                  </code>
                  <CopyButton value={inviteUrl} />
                </div>
              </div>

              {/* QRコード */}
              <div className="flex flex-col items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
                <div className="text-xs font-bold text-stone-700 inline-flex items-center gap-1.5 self-start">
                  <QrCode className="w-3.5 h-3.5" strokeWidth={2.2} />
                  店頭ポスター用 QRコード
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/api/store/invite/qr"
                  alt="友だち追加QRコードLINE"
                  width={200}
                  height={200}
                  className="w-44 h-44 bg-white rounded-lg border border-stone-200"
                />
                <a
                  href="/api/store/invite/qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.2} />
                  別タブで開く（印刷・保存）
                </a>
              </div>

              {/* 共有のヒント */}
              <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs p-3 rounded-xl space-y-1">
                <div className="font-bold">共有のしかた</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>入会時・カウンセリング時にQRをその場で読み取ってもらう</li>
                  <li>QRを印刷して受付・更衣室に掲示する</li>
                  <li>既存のお客様にはLINEやメールでリンクを送る</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* 困ったとき */}
        <p className="text-center text-[11px] text-stone-400">
          設定の変更は「設定 &gt; LINE連携設定」からいつでも行えます。
        </p>
      </div>
    </AdminShell>
  );
}
