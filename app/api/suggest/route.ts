import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDate,
} from '@/lib/notion';
import { suggestMeals, type MealSuggestion } from '@/lib/gemini';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jstTodayString(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function jstHour(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours();
}

export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const date = req.nextUrl.searchParams.get('date') || jstTodayString();

    const [customer, records] = await Promise.all([
      getCustomerByLineId(verifiedLineUserId),
      getFoodRecordsByDate(verifiedLineUserId, date),
    ]);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const totals = records.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    const remaining = {
      kcal: Math.round(customer.goals.kcal - totals.kcal),
      P: Math.round((customer.goals.P - totals.P) * 10) / 10,
      F: Math.round((customer.goals.F - totals.F) * 10) / 10,
      C: Math.round((customer.goals.C - totals.C) * 10) / 10,
    };

    // 既に十分摂取 or 超過の場合は提案不要
    if (remaining.kcal < 100) {
      const overshoot = remaining.kcal < -100;
      return NextResponse.json({
        remaining,
        suggestions: [] as MealSuggestion[],
        message: overshoot
          ? '本日はカロリーを超過しています。明日に向けて軽めの調整を。'
          : '本日の目標カロリーをほぼ達成しています ✨',
      });
    }

    const recordedMealTypes = Array.from(
      new Set(records.map((r) => r.mealType).filter(Boolean))
    );

    const suggestions = await suggestMeals({
      remaining,
      hour: jstHour(),
      recordedMealTypes,
    });

    return NextResponse.json({
      remaining,
      suggestions,
      message: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
