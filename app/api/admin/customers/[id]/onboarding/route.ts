import { NextRequest, NextResponse } from 'next/server';
import { patchCustomer } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const DELETE = withAdminTenant(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const tourResetAt = new Date().toISOString();
  try {
    await patchCustomer(id, { onboardingCompletedAt: null, tourResetAt });
  } catch (e) {
    // tourResetAt 列が Notion DB に存在しない場合など Notion 400 対策
    // onboardingCompletedAt だけでも確実にリセットする
    console.error('[onboarding DELETE] combined patch failed, retrying without tourResetAt:', e);
    await patchCustomer(id, { onboardingCompletedAt: null });
    // tourResetAt 単体で書き込み（失敗しても 500 は返さない）
    try {
      await patchCustomer(id, { tourResetAt });
    } catch (e2) {
      console.error('[onboarding DELETE] tourResetAt patch failed (column may not exist in Notion DB):', e2);
    }
  }
  return NextResponse.json({ ok: true });
});
