import { NextRequest, NextResponse } from 'next/server';
import { getCustomer, patchCustomer, type CustomerPatch } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ customer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const PATCH = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = (await req.json()) as CustomerPatch;
    const patch: CustomerPatch = {};
    if (body.name && typeof body.name === 'string') patch.name = body.name.trim();
    if (body.goals && typeof body.goals === 'object') patch.goals = body.goals;
    if ('targetWeight' in body) patch.targetWeight = body.targetWeight;
    if ('targetDate' in body) patch.targetDate = body.targetDate;
    if ('foodStatus' in body) patch.foodStatus = body.foodStatus;
    if ('gender' in body) patch.gender = body.gender;
    if ('heightCm' in body) patch.heightCm = body.heightCm;
    if ('age' in body) patch.age = body.age;
    if ('activityLevel' in body) patch.activityLevel = body.activityLevel;
    if ('plan' in body) patch.plan = body.plan;
    if ('currentWeight' in body) patch.currentWeight = body.currentWeight;
    if ('storeId' in body) patch.storeId = body.storeId;
    if ('lineUserId' in body) patch.lineUserId = body.lineUserId;
    await patchCustomer(id, patch);
    const customer = await getCustomer(id);
    return NextResponse.json({ ok: true, customer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
