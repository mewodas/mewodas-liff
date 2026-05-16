import { NextRequest, NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/inviteToken';
import { runWithTenantById } from '@/lib/withTenant';
import { getCustomer, patchCustomer } from '@/lib/repository/customers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const lineUserId = String(body.lineUserId || '').trim();
    const displayName = String(body.displayName || '').trim();

    if (!token || !lineUserId) {
      return NextResponse.json({ error: 'token と lineUserId が必要です' }, { status: 400 });
    }

    const payload = verifyInviteToken(token);
    if (!payload) {
      return NextResponse.json({ error: '招待リンクの有効期限が切れているか、URLが正しくありません' }, { status: 400 });
    }

    const { customerId, tenantId } = payload;

    return await runWithTenantById(tenantId, async () => {
      const customer = await getCustomer(customerId);
      if (!customer) {
        return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
      }

      if (customer.lineUserId && customer.lineUserId !== lineUserId) {
        return NextResponse.json(
          { error: 'このリンクは別のアカウントで使用済みです。トレーナーにご連絡ください。' },
          { status: 409 }
        );
      }

      const patch: { lineUserId: string; foodStatus?: string } = { lineUserId };
      if (customer.foodStatus === '設定中') {
        patch.foodStatus = '進行中';
      }

      await patchCustomer(customerId, patch);

      return NextResponse.json({
        ok: true,
        customerId,
        customerName: displayName || customer.name,
      });
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
