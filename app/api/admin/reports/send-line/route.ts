import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCustomer } from '@/lib/repository/customers';
import { pushLineMessage, createNotification, isNotificationsConfigured, type NotificationCategory } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withAdminTenant(async (req: NextRequest) => {
  const body = await req.json();
  const customerId = String(body.customerId || '').trim();
  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  const staffName = String(body.staffName || '').trim();
  const category = (body.category || 'アドバイス') as NotificationCategory;

  if (!customerId || !title || !text) {
    return NextResponse.json({ error: 'customerId / title / body が必要です' }, { status: 400 });
  }

  const customer = await getCustomer(customerId);
  if (!customer) return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
  if (!customer.lineUserId) {
    return NextResponse.json({ error: '顧客の LINE ユーザーID が未登録です' }, { status: 400 });
  }

  const push = await pushLineMessage(customer.lineUserId, title, text, staffName || undefined);

  let notification = null;
  if (isNotificationsConfigured()) {
    notification = await createNotification({
      lineUserId: customer.lineUserId,
      customerName: customer.name,
      category,
      title,
      body: text,
      staffName: staffName || undefined,
    });
  }

  return NextResponse.json({ ok: true, push, notification });
});
