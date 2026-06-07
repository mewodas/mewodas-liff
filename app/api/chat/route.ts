import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, getFoodRecordsByDate, getTargetDate } from '@/lib/notion';
import { chatWithAi, type ChatMessage } from '@/lib/gemini';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function jstHour(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours();
}

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { message, history } = body as {
      message?: string;
      history?: ChatMessage[];
    };

    if (!message) {
      return NextResponse.json(
        { error: 'message は必須です' },
        { status: 400 }
      );
    }
    if (message.length > 500) {
      return NextResponse.json(
        { error: 'メッセージは500文字以内' },
        { status: 400 }
      );
    }

    const sanitizedMessage = message.replace(/[\r\n]/g, ' ');

    const today = getTargetDate('今日');
    const [customer, records] = await Promise.all([
      getCustomerByLineId(verifiedLineUserId),
      getFoodRecordsByDate(verifiedLineUserId, today),
    ]);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const todayTotals = records.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        P: acc.P + r.P,
        F: acc.F + r.F,
        C: acc.C + r.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );
    const todayMealTypes = Array.from(new Set(records.map((r) => r.mealType).filter(Boolean)));

    const reply = await chatWithAi({
      message: sanitizedMessage,
      history: Array.isArray(history) ? history : [],
      customerContext: {
        name: customer.name,
        goals: customer.goals,
        todayTotals: {
          kcal: Math.round(todayTotals.kcal),
          P: Math.round(todayTotals.P * 10) / 10,
          F: Math.round(todayTotals.F * 10) / 10,
          C: Math.round(todayTotals.C * 10) / 10,
        },
        todayMealTypes,
        currentHour: jstHour(),
        currentWeight: customer.currentWeight,
        targetWeight: customer.targetWeight,
      },
    });

    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    console.error('[chat/route] unexpected error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'AIが混み合っています。しばらくしてからもう一度お試しください。' },
      { status: 500 }
    );
  }
});
