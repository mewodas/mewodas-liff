import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCustomer, patchCustomer } from '@/lib/repository/customers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 承認制モードで「承認待ち」ステータスの顧客を「進行中」に切り替えるエンドポイント。
// /store/customers の承認待ちタブから「承認」ボタンが呼び出す。
export const POST = withAdminTenant(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (customer.foodStatus !== '承認待ち') {
      return NextResponse.json(
        { error: `承認できるのは「承認待ち」ステータスの顧客のみです（現在: ${customer.foodStatus ?? '未設定'}）` },
        { status: 400 }
      );
    }
    await patchCustomer(id, { foodStatus: '進行中' });
    return NextResponse.json({ ok: true, customerId: id, newStatus: '進行中' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
