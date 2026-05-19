'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Users,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import SeatChangeModal from './SeatChangeModal';

const MIN_SEATS = 3;
const SUPPORT_FEE = 5500;

function getPlanTier(seats: number): string {
  if (seats <= 20) return 'Starter';
  if (seats <= 50) return 'Growth';
  return 'Scale';
}

function getUnitPrice(seats: number): number {
  if (seats <= 20) return 2750;
  if (seats <= 50) return 2200;
  return 1650;
}

function getMonthlyTotal(seats: number): number {
  return SUPPORT_FEE + getUnitPrice(seats) * seats;
}

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
  seatLimit: number | null;
  currentSeats: number;
  totalCustomers?: number;
  remaining: number | null;
  isOverLimit: boolean;
  isNearLimit: boolean;
  planTier: string | null;
  hasContract: boolean;
};

export default function BillingPage() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seats, setSeats] = useState(MIN_SEATS);
  const [processing, setProcessing] = useState(false);
  const [showSeatModal, setShowSeatModal] = useState(false);

  async function loadInfo() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/billing/info', { cache: 'no-store' });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setInfo(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadInfo(); }, []);

  const unitPrice = getUnitPrice(seats);
  const monthlyTotal = getMonthlyTotal(seats);
  const tier = getPlanTier(seats);

  async function startCheckout() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats }),
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
      {showSeatModal && info?.hasContract && info.seatLimit !== null && (
        <SeatChangeModal
          currentSeats={info.seatLimit}
          currentUseCount={info.currentSeats}
          onClose={() => setShowSeatModal(false)}
          onSuccess={() => {
            setShowSeatModal(false);
            setTimeout(() => loadInfo(), 2000);
          }}
        />
      )}

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
            {/* 上限到達バナー */}
            {info?.isOverLimit && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-xl inline-flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
                <div>
                  <div className="font-bold">席数上限に達しています（{info.seatLimit}名満席）</div>
                  <div>新規招待・顧客追加には増枠が必要です。</div>
                </div>
              </div>
            )}

            {/* 残り1席バナー */}
            {!info?.isOverLimit && info?.isNearLimit && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl inline-flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
                <div>あと1名で席数上限です。早めの増枠をご検討ください。</div>
              </div>
            )}

            {/* 契約済み */}
            {info?.hasContract && info.seatLimit !== null ? (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
                  現在の契約
                </h2>

                {/* プラン・席数 */}
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="プラン" value={info.planTier || '—'} />
                  <Stat
                    label="支払いステータス"
                    value={info.paymentStatus || '—'}
                    highlight={info.paymentStatus === '有効'}
                  />
                </div>

                {/* 席数プログレスバー */}
                <div className="bg-stone-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" strokeWidth={2.4} />
                      契約席数 {info.seatLimit}名
                    </span>
                    <span>使用 {info.currentSeats}名 / 残り {info.remaining !== null ? info.remaining : '—'}名</span>
                  </div>
                  {typeof info.totalCustomers === 'number' && info.totalCustomers !== info.currentSeats && (
                    <div className="text-[10px] text-stone-500">
                      ※ 「進行中」の顧客のみ席数カウント対象（設定中・休止中・卒業は除外。総顧客 {info.totalCustomers}名）
                    </div>
                  )}
                  <div className="w-full bg-stone-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        info.isOverLimit
                          ? 'bg-rose-500'
                          : info.isNearLimit
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, info.seatLimit > 0 ? (info.currentSeats / info.seatLimit) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="月額料金"
                    value={info.monthlyPrice ? `¥${info.monthlyPrice.toLocaleString()}` : '—'}
                  />
                  <Stat
                    label="次回請求日"
                    value={info.nextBillingDate || '—'}
                  />
                </div>

                <div className="text-[10px] text-stone-500">
                  サポート費 ¥{SUPPORT_FEE.toLocaleString()}/月 + per-user 合計
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSeatModal(true)}
                    disabled={processing}
                    className="flex-1 bg-emerald-500 text-white font-bold py-2.5 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <TrendingUp className="w-4 h-4" strokeWidth={2.2} />
                    席数を変更（増減枠）
                  </button>
                  <button
                    onClick={openPortal}
                    disabled={processing}
                    className="flex-1 bg-stone-100 text-stone-900 font-bold py-2.5 rounded-xl active:bg-stone-200 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" strokeWidth={2.2} />
                    カード・解約
                  </button>
                </div>
              </section>
            ) : (
              <>
                {/* 未契約: Stripe Customer ID はあるが支払いステータスが解約済み/期限切れ等の場合
                    現在の契約セクションは表示せず、新規契約フォームのみ見せる。
                    過去の請求履歴を確認したい場合は新規契約フォーム下のリンクから Portal へ */}

                {/* プラン比較（席数で自動判定・選択不可） */}
                <div className="text-[11px] text-stone-600 text-center font-bold">
                  プラン一覧（席数によって自動で決まります）
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { tier: 'Starter', range: '3〜20名', minSeats: 3, unitPrice: 2750 },
                    { tier: 'Growth', range: '21〜50名', minSeats: 21, unitPrice: 2200 },
                    { tier: 'Scale', range: '51名+', minSeats: 51, unitPrice: 1650 },
                  ] as const).map((p) => (
                    <div
                      key={p.tier}
                      aria-disabled
                      className={`rounded-xl border-2 p-3 space-y-1 text-center select-none ${
                        tier === p.tier
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-dashed border-stone-200 bg-stone-50 opacity-70'
                      }`}
                    >
                      <div className="text-xs font-bold text-stone-900 inline-flex items-center gap-1 justify-center">
                        {p.tier}
                        {tier === p.tier && (
                          <span className="text-[9px] text-emerald-700 bg-emerald-200 rounded px-1">適用中</span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-500">{p.range}</div>
                      <div className="text-sm font-bold text-emerald-700">¥{p.unitPrice.toLocaleString()}</div>
                      <div className="text-[9px] text-stone-500">/人/月</div>
                      <div className="text-[10px] text-stone-600 font-bold">
                        {p.minSeats}名〜 ¥{(SUPPORT_FEE + p.unitPrice * p.minSeats).toLocaleString()}/月〜
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-stone-500 text-center">
                  サポート費 ¥5,500/月 + per-user × 席数（すべて税込）
                </div>

                {/* 新規契約フォーム */}
                <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
                  <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
                    新規契約
                  </h2>

                  <div>
                    <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
                      <Users className="w-3 h-3" strokeWidth={2.4} />
                      席数（ミニマム {MIN_SEATS}名）
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSeats(Math.max(MIN_SEATS, seats - 1))}
                        className="w-10 h-10 bg-stone-100 rounded-xl active:bg-stone-200 text-xl font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={seats}
                        min={MIN_SEATS}
                        onChange={(e) => setSeats(Math.max(MIN_SEATS, parseInt(e.target.value, 10) || MIN_SEATS))}
                        className="flex-1 text-center text-lg font-bold bg-stone-50 border border-stone-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={() => setSeats(seats + 1)}
                        className="w-10 h-10 bg-stone-100 rounded-xl active:bg-stone-200 text-xl font-bold"
                      >
                        ＋
                      </button>
                    </div>
                    <div className="text-[10px] text-stone-500 mt-1">
                      プラン: {tier}（¥{unitPrice.toLocaleString()}/人/月）
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-stone-700 font-bold mb-1">月額（毎月自動引き落とし）</div>
                    <div className="text-2xl font-bold text-emerald-700">
                      ¥{monthlyTotal.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      サポート費¥{SUPPORT_FEE.toLocaleString()} + ¥{unitPrice.toLocaleString()} × {seats}名
                    </div>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 text-center">
                    <div className="text-xs font-bold text-blue-900 mb-0.5">🎁 14日間 無料トライアル</div>
                    <div className="text-[10px] text-blue-800">
                      カード登録後 14日間は請求されません。期間中いつでもキャンセル可能。
                    </div>
                  </div>

                  <button
                    onClick={startCheckout}
                    disabled={processing}
                    className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" strokeWidth={2.2} />
                    {processing ? '処理中…' : '無料で14日間試す（カード登録）'}
                  </button>

                  <div className="text-[10px] text-stone-500 text-center">
                    初期費用なし・違約金なし・月払いサブスク
                  </div>
                </section>

                {/* 過去契約の請求履歴アクセス（過去にカード登録経験がある場合のみ） */}
                {info?.hasStripeCustomer && (
                  <button
                    onClick={openPortal}
                    disabled={processing}
                    className="w-full text-[11px] text-stone-500 underline py-2 disabled:opacity-50"
                  >
                    過去の請求履歴を見る
                  </button>
                )}
              </>
            )}

            {/* ステータス系バナー */}
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
