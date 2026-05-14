import { NextRequest, NextResponse } from 'next/server';
import { getCustomer, patchCustomer, type CustomerPatch } from '@/lib/repository/customers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as CustomerPatch;
    const patch: CustomerPatch = {};
    if (body.goals && typeof body.goals === 'object') patch.goals = body.goals;
    if ('targetWeight' in body) patch.targetWeight = body.targetWeight;
    if ('targetDate' in body) patch.targetDate = body.targetDate;
    if ('foodStatus' in body) patch.foodStatus = body.foodStatus;
    await patchCustomer(id, patch);
    const customer = await getCustomer(id);
    return NextResponse.json({ ok: true, customer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
