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
import type { PlanDef } from './notion';

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

/** 標準プランの Volume 段階表 */
export const STANDARD_VOLUME_TIERS = [
  { upTo: 20, unitAmount: 2750 },
  { upTo: 50, unitAmount: 2200 },
  { upTo: Infinity, unitAmount: 1650 },
];

/** PlanDef を受け取り月額合計を算出 */
export function getMonthlyTotalFromPlan(
  plan: PlanDef,
  seats: number
): {
  supportFee: number;
  unitPrice: number;
  perUserSubtotal: number;
  total: number;
} {
  let unitPrice: number;
  if (plan.volumeApplied) {
    const tier = STANDARD_VOLUME_TIERS.find((t) => seats <= t.upTo) ?? STANDARD_VOLUME_TIERS[STANDARD_VOLUME_TIERS.length - 1];
    unitPrice = tier.unitAmount;
  } else {
    unitPrice = plan.perUserPrice;
  }
  const perUserSubtotal = unitPrice * seats;
  return {
    supportFee: plan.supportFee,
    unitPrice,
    perUserSubtotal,
    total: plan.supportFee + perUserSubtotal,
  };
}

/** PlanDef + 席数から Stripe line items を生成。
 *  planCode が 'standard' で Price ID 未設定の場合 env にフォールバック。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSubscriptionLineItems(plan: PlanDef, seats: number): any[] {
  const { supportFee, unitPrice } = getMonthlyTotalFromPlan(plan, seats);

  // Price ID の解決（planCode=standard は env フォールバック）
  let supportFeePriceId = plan.stripeSupportFeePriceId || null;
  let perUserPriceId = plan.stripePerUserPriceId || null;
  if (plan.planCode === 'standard') {
    supportFeePriceId = supportFeePriceId || process.env.STRIPE_PRICE_SUPPORT_FEE || null;
    perUserPriceId = perUserPriceId || process.env.STRIPE_PRICE_PER_USER || null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];

  if (supportFee > 0) {
    items.push(
      supportFeePriceId
        ? { price: supportFeePriceId, quantity: 1 }
        : {
            price_data: {
              currency: 'jpy',
              product_data: { name: 'FitMeal サポート費' },
              unit_amount: supportFee,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          }
    );
  }

  items.push(
    perUserPriceId
      ? { price: perUserPriceId, quantity: seats }
      : {
          price_data: {
            currency: 'jpy',
            product_data: { name: `FitMeal per-user (${plan.name})` },
            unit_amount: unitPrice,
            recurring: { interval: 'month' },
          },
          quantity: seats,
        }
  );

  return items;
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
