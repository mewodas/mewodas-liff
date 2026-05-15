import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateString: string, n: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export const GET = withAdminTenant(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 30));
    const today = jstToday();
    const startDate = addDays(today, -days + 1);

    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) return NextResponse.json({ logs: [] });

    const logs = await listExerciseLogsByLineUser(customer.lineUserId, startDate, today);
    return NextResponse.json({ logs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
