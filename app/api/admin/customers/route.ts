import { NextResponse } from 'next/server';
import { listCustomers } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

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
