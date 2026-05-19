import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, updateCustomer } from '@/lib/notion';
import { withLiffTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withLiffTenant(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId, { force: true });
  if (!customer) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const tenant = getCurrentTenant();
  return NextResponse.json({ customer, officialLineUrl: tenant.officialLineUrl ?? null });
});

export const PATCH = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const customer = await getCustomerByLineId(verifiedLineUserId, { force: true });
  if (!customer) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const patch: Parameters<typeof updateCustomer>[1] = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if (body.furigana !== undefined) {
    if (body.furigana === null || body.furigana === '') {
      patch.furigana = null;
    } else if (typeof body.furigana === 'string') {
      patch.furigana = body.furigana.trim().slice(0, 100);
    }
  }
  if (body.gender !== undefined) {
    patch.gender = typeof body.gender === 'string' ? body.gender : null;
  }
  if (body.heightCm !== undefined) {
    if (body.heightCm === null) {
      patch.heightCm = null;
    } else if (typeof body.heightCm === 'number') {
      if (body.heightCm < 50 || body.heightCm > 250) {
        return NextResponse.json({ error: '身長は50〜250cmの範囲で入力してください' }, { status: 422 });
      }
      patch.heightCm = body.heightCm;
    }
  }
  if (body.currentWeight !== undefined) {
    if (body.currentWeight === null) {
      patch.currentWeight = null;
    } else if (typeof body.currentWeight === 'number') {
      if (body.currentWeight < 20 || body.currentWeight > 300) {
        return NextResponse.json({ error: '体重は20〜300kgの範囲で入力してください' }, { status: 422 });
      }
      patch.currentWeight = body.currentWeight;
    }
  }
  if (body.birthDate !== undefined) {
    if (body.birthDate === null) {
      patch.birthDate = null;
    } else if (typeof body.birthDate === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) {
        return NextResponse.json({ error: '生年月日はYYYY-MM-DD形式で入力してください' }, { status: 422 });
      }
      patch.birthDate = body.birthDate;
    }
  }

  if (Object.keys(patch).length > 0) {
    await updateCustomer(customer.pageId, patch);
  }

  const updated = await getCustomerByLineId(verifiedLineUserId, { force: true });
  return NextResponse.json({ customer: updated });
});
