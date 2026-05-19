// Stripe SDK 初期化 + 料金体系定義
//
// FitMeal SaaS 新プラン（2026-05-19 〜、価格は税込、Stripe Volume Pricing）:
//   サポート費: ¥5,500/月 固定（税込・別 line item）
//   per-user Volume tiers（1 つの Price で席数に応じて自動切替）:
//     1-20 名: ¥2,750/人/月（税込）
//     21-50 名: ¥2,200/人/月（税込）
//     51+ 名: ¥1,650/人/月（税込）
//   ミニマム 3 名（Portal / アプリ側で担保。Stripe Price 自体は 1 から開始可能）
//
// env:
//   STRIPE_SECRET_KEY: sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET: whsec_...
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_... or pk_live_...
//   STRIPE_PRICE_SUPPORT_FEE: price_... (¥5,500 固定)
//   STRIPE_PRICE_PER_USER: price_... (Volume tiered)

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY 未設定');
  }
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

export type PlanTier = 'Starter' | 'Growth' | 'Scale';

export const SUPPORT_FEE = 5500;
export const MIN_SEATS = 3;

export function getPlanTierBySeats(seats: number): PlanTier {
  if (seats <= 20) return 'Starter';
  if (seats <= 50) return 'Growth';
  return 'Scale';
}

export function getUnitPriceByTier(tier: PlanTier): number {
  if (tier === 'Starter') return 2750;
  if (tier === 'Growth') return 2200;
  return 1650;
}

export function getMonthlyTotal(seats: number): {
  tier: PlanTier;
  unitPrice: number;
  supportFee: number;
  perUserSubtotal: number;
  total: number;
} {
  const tier = getPlanTierBySeats(seats);
  const unitPrice = getUnitPriceByTier(tier);
  const perUserSubtotal = unitPrice * seats;
  return {
    tier,
    unitPrice,
    supportFee: SUPPORT_FEE,
    perUserSubtotal,
    total: SUPPORT_FEE + perUserSubtotal,
  };
}

export function getMinSeats(): number {
  return MIN_SEATS;
}

export function getPerUserPriceId(): string | null {
  return process.env.STRIPE_PRICE_PER_USER || null;
}

export function getSupportFeePriceId(): string | null {
  return process.env.STRIPE_PRICE_SUPPORT_FEE || null;
}

/** 後方互換: tier に関係なく単一の per-user Price ID を返す */
export function getPriceIdForTier(_tier: PlanTier): string | null {
  return getPerUserPriceId();
}

export function subscriptionStatusToNotion(
  stripeStatus: Stripe.Subscription.Status
): '有効' | '期限切れ' | '未払い' | 'お試し' | 'キャンセル予定' | '解約済み' {
  switch (stripeStatus) {
    case 'active':
      return '有効';
    case 'trialing':
      return 'お試し';
    case 'past_due':
      return '未払い';
    case 'unpaid':
      return '期限切れ';
    case 'canceled':
      return '解約済み';
    case 'incomplete':
    case 'incomplete_expired':
      return '期限切れ';
    case 'paused':
      return 'キャンセル予定';
    default:
      return '解約済み';
  }
}
