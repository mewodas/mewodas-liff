import { NextRequest, NextResponse } from 'next/server';
import { patchCustomer } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const DELETE = withAdminTenant(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await patchCustomer(id, { onboardingCompletedAt: null });
  return NextResponse.json({ ok: true });
});
