import { NextResponse } from 'next/server';
import { listCustomers, createCustomer } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';
import { getSeatStatus, invalidateSeatCache } from '@/lib/seats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async () => {
  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const POST = withAdminTenant(async (req) => {
  try {
    // 席数上限チェック
    const seatStatus = await getSeatStatus({ noCache: true });
    if (seatStatus.isOverLimit) {
      return NextResponse.json(
        { error: 'seat_limit_reached', seatLimit: seatStatus.seatLimit, currentSeats: seatStatus.currentSeats },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: '氏名必須' }, { status: 400 });
    const customer = await createCustomer({
      name,
      lineUserId: body.lineUserId ? String(body.lineUserId).trim() : undefined,
      foodStatus: body.foodStatus || '設定中',
      gender: body.gender || undefined,
      heightCm: typeof body.heightCm === 'number' ? body.heightCm : undefined,
      age: typeof body.age === 'number' ? body.age : undefined,
      activityLevel: body.activityLevel || undefined,
      plan: body.plan || undefined,
      currentWeight: typeof body.currentWeight === 'number' ? body.currentWeight : undefined,
      targetWeight: typeof body.targetWeight === 'number' ? body.targetWeight : undefined,
      targetDate: body.targetDate || undefined,
      goals: body.goals && typeof body.goals === 'object' ? body.goals : undefined,
      storeId: body.storeId || undefined,
    });
    invalidateSeatCache();
    return NextResponse.json({ ok: true, customer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
