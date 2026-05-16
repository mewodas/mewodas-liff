'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Users,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Calculator,
} from 'lucide-react';
import AdminShell from '../AdminShell';

type BillingInfo = {
  tenantName: string;
  ownerEmail: string | null;
  plan: string | null;
  customerCount: number | null;
  monthlyPrice: number | null;
  billingCycle: string | null;
  nextBillingDate: string | null;
  paymentStatus: string | null;
  hasStripeCustomer: boolean;
};

function unitPriceFor(n: number): number {
  if (n <= 10) return 3000;
  if (n <= 20) return 2500;
  return 2000;
}

export default function BillingPage() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerCount, setCustomerCount] = useState(10);
  const [billingCycle, setBillingCycle] = useState<'月払い' | '年払い'>('月払い');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch('/api/admin/billing/info', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setInfo(j);
        if (j.customerCount) setCustomerCount(j.customerCount);
        if (j.billingCycle === '年払い') setBillingCycle('年払い');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const unitPrice = unitPriceFor(customerCount);
  const monthlyTotal = customerCount * unitPrice;
  const annualTotal = Math.round(monthlyTotal * 12 * 0.9);
  const displayTotal = billingCycle === '年払い' ? annualTotal : monthlyTotal;

  async function startCheckout() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerCount, billingCycle }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `失敗(${res.status})`);
      if (j.url) window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setProcessing(false);
    }
  }

  async function openPortal() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `失敗(${res.status})`);
      if (j.url) window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AdminShell title="お支払い・プラン">
      <div className="space-y-3">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : (
          <>
            {/* 現在の契約状況 */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
                現在の契約
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="プラン" value={info?.plan || '未契約'} />
                <Stat
                  label="支払いステータス"
                  value={info?.paymentStatus || '—'}
                  highlight={info?.paymentStatus === '有効'}
                />
                <Stat
                  label="顧客数"
                  value={info?.customerCount ? `${info.customerCount}名` : '—'}
                />
                <Stat
                  label="月額料金"
                  value={info?.monthlyPrice ? `¥${info.monthlyPrice.toLocaleString()}` : '—'}
                />
                <Stat
                  label="請求サイクル"
                  value={info?.billingCycle || '—'}
                />
                <Stat
                  label="次回請求日"
                  value={info?.nextBillingDate || '—'}
                />
              </div>
              {info?.hasStripeCustomer && (
                <button
                  onClick={openPortal}
                  disabled={processing}
                  className="w-full bg-stone-100 text-stone-900 font-bold py-2.5 rounded-xl active:bg-stone-200 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" strokeWidth={2.2} />
                  カード変更・解約・請求履歴
                </button>
              )}
            </section>

            {/* プラン選択（新規 or 変更） */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
                {info?.hasStripeCustomer ? 'プラン変更' : '新規契約'}
              </h2>

              {/* 顧客数 */}
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
                  <Users className="w-3 h-3 text-stone-600" strokeWidth={2.4} />
                  顧客数
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCustomerCount(Math.max(1, customerCount - 1))}
                    className="w-10 h-10 bg-stone-100 rounded-xl active:bg-stone-200 text-xl font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={customerCount}
                    onChange={(e) => setCustomerCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 text-center text-lg font-bold bg-stone-50 border border-stone-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={() => setCustomerCount(customerCount + 1)}
                    className="w-10 h-10 bg-stone-100 rounded-xl active:bg-stone-200 text-xl font-bold"
                  >
                    ＋
                  </button>
                </div>
                <div className="text-[10px] text-stone-500 mt-1">
                  単価: ¥{unitPrice.toLocaleString()}/月/人
                  {customerCount > 10 && customerCount <= 20 && '（11-20名割引）'}
                  {customerCount > 20 && '（21名+割引）'}
                </div>
              </div>

              {/* 請求サイクル */}
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-stone-600" strokeWidth={2.4} />
                  請求サイクル
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBillingCycle('月払い')}
                    className={`p-3 rounded-xl border-2 text-left ${
                      billingCycle === '月払い'
                        ? 'bg-emerald-50 border-emerald-500'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-stone-900">月払い</div>
                    <div className="text-lg font-bold text-emerald-700">
                      ¥{monthlyTotal.toLocaleString()}/月
                    </div>
                  </button>
                  <button
                    onClick={() => setBillingCycle('年払い')}
                    className={`p-3 rounded-xl border-2 text-left relative ${
                      billingCycle === '年払い'
                        ? 'bg-emerald-50 border-emerald-500'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <div className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      10%OFF
                    </div>
                    <div className="text-xs font-bold text-stone-900">年払い</div>
                    <div className="text-lg font-bold text-emerald-700">
                      ¥{annualTotal.toLocaleString()}/年
                    </div>
                  </button>
                </div>
              </div>

              {/* 合計 */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <div className="text-xs text-stone-700 font-bold mb-1">
                  {billingCycle === '年払い' ? '年額（一括払い）' : '月額（毎月引き落とし）'}
                </div>
                <div className="text-2xl font-bold text-emerald-700">
                  ¥{displayTotal.toLocaleString()}
                </div>
                {billingCycle === '年払い' && (
                  <div className="text-[10px] text-stone-600 mt-0.5">
                    通常: ¥{(monthlyTotal * 12).toLocaleString()}/年 → 10% OFF
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={startCheckout}
                disabled={processing}
                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" strokeWidth={2.2} />
                {processing
                  ? '処理中…'
                  : info?.hasStripeCustomer
                  ? 'プラン変更を確認'
                  : 'カード登録してプラン開始'}
              </button>

              <div className="text-[10px] text-stone-500 text-center">
                法人で請求書払いをご希望の場合はトレーナー（FitMeal 運営）にご連絡ください
              </div>
            </section>

            {/* お試し期間 */}
            {info?.paymentStatus === 'お試し' && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs p-3 rounded-xl inline-flex gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
                お試し期間中です。期間終了前にカード登録をお願いします。
              </div>
            )}
            {info?.paymentStatus === '未払い' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl inline-flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
                お支払いに失敗しました。カード情報を更新してください。
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-stone-50 rounded-xl p-3">
      <div className="text-[10px] text-stone-500 font-bold mb-1">{label}</div>
      <div className={`text-sm font-bold ${highlight ? 'text-emerald-700' : 'text-stone-900'}`}>
        {value}
      </div>
    </div>
  );
}
