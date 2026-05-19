// Stripe SDK 初期化 + 料金体系定義
//
// メヲダス FitMeal SaaS:
//   - 初期セットアップ: ¥30,000 (one-time)
//   - 月額: 5-10名=¥3,000/人, 11-20名=¥2,500/人, 21名+=¥2,000/人
//   - 年払いは10%OFF（実質1.2ヶ月分割引）
//
// env:
//   STRIPE_SECRET_KEY: sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET: whsec_...
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_... or pk_live_...

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

/**
 * 人数に応じた1人あたりの月額単価（円）
 */
export function unitPriceFor(customerCount: number): number {
  if (customerCount <= 10) return 3000;
  if (customerCount <= 20) return 2500;
  return 2000;
}

/**
 * 人数 × 単価で月額料金を計算
 */
export function monthlyPriceFor(customerCount: number): number {
  return customerCount * unitPriceFor(customerCount);
}

/**
 * 年払いの場合の料金（10%OFF）
 */
export function annualPriceFor(customerCount: number): number {
  return Math.round(monthlyPriceFor(customerCount) * 12 * 0.9);
}

/**
 * Stripe Subscription の status を Notion の支払いステータスに変換
 */
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
