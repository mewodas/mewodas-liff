import { NextRequest, NextResponse } from 'next/server';
import { withMasterOnly } from '@/lib/withTenant';
import { getPlanByCode, updatePlan } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = withMasterOnly(async (req: NextRequest, { params }: { params: Promise<{ code: string }> }) => {
  try {
    const { code } = await params;
    const plan = await getPlanByCode(code);
    if (!plan) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const body = await req.json();
    const patch: Parameters<typeof updatePlan>[1] = {};
    if ('name' in body) patch.name = String(body.name);
    if ('planCode' in body) patch.planCode = String(body.planCode);
    if ('kind' in body) patch.kind = body.kind;
    if ('supportFee' in body) patch.supportFee = Number(body.supportFee);
    if ('perUserPrice' in body) patch.perUserPrice = Number(body.perUserPrice);
    if ('volumeApplied' in body) patch.volumeApplied = !!body.volumeApplied;
    if ('minSeats' in body) patch.minSeats = Number(body.minSeats);
    if ('billingCycle' in body) patch.billingCycle = body.billingCycle;
    if ('stripeSupportFeePriceId' in body) patch.stripeSupportFeePriceId = body.stripeSupportFeePriceId || null;
    if ('stripePerUserPriceId' in body) patch.stripePerUserPriceId = body.stripePerUserPriceId || null;
    if ('published' in body) patch.published = !!body.published;
    if ('active' in body) patch.active = !!body.active;
    if ('note' in body) patch.note = body.note || null;

    await updatePlan(plan.pageId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
