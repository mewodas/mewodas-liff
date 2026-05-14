import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listRecordsByDate } from '@/lib/repository/records';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const date = req.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date required' }, { status: 400 });
    }
    const customer = await getCustomer(id);
    if (!customer) {
      return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
    }
    if (!customer.lineUserId) {
      return NextResponse.json({ records: [], customer, warning: 'lineUserId 未設定' });
    }
    const records = await listRecordsByDate(customer.lineUserId, date);
    return NextResponse.json({ records, customer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
