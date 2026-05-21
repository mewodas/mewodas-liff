import { NextRequest, NextResponse } from 'next/server';
import { withMasterOnly } from '@/lib/withTenant';
import { listPlans, createPlan } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withMasterOnly(async () => {
  try {
    const plans = await listPlans();
    return NextResponse.json({ plans });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withMasterOnly(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, planCode, kind, supportFee, perUserPrice, volumeApplied, minSeats, billingCycle, stripeSupportFeePriceId, stripePerUserPriceId, published, active, note } = body;
    if (!name || !planCode || !kind) {
      return NextResponse.json({ error: 'name / planCode / kind は必須' }, { status: 400 });
    }
    const plan = await createPlan({
      name: String(name),
      planCode: String(planCode),
      kind,
      supportFee: Number(supportFee ?? 0),
      perUserPrice: Number(perUserPrice ?? 0),
      volumeApplied: !!volumeApplied,
      minSeats: Number(minSeats ?? 3),
      billingCycle: billingCycle || '月払い',
      stripeSupportFeePriceId: stripeSupportFeePriceId || null,
      stripePerUserPriceId: stripePerUserPriceId || null,
      published: !!published,
      active: active !== false,
      note: note || null,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
