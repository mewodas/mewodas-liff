import { NextResponse } from 'next/server';
import {
  createNotification,
  listAllNotifications,
  pushLineMessage,
  isNotificationsConfigured,
  type NotificationCategory,
} from '@/lib/notifications';
import { getCustomer } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async () => {
  if (!isNotificationsConfigured()) {
    return NextResponse.json({ configured: false, notifications: [] });
  }
  const notifications = await listAllNotifications(100);
  return NextResponse.json({ configured: true, notifications });
});

export const POST = withAdminTenant(async (req) => {
  if (!isNotificationsConfigured()) {
    return NextResponse.json(
      { error: 'NOTION_NOTIFICATIONS_DB_ID 未設定（通知DB を作成して環境変数を設定してください）' },
      { status: 503 }
    );
  }
  try {
    const body = await req.json();
    const customerId = String(body.customerId || '');
    const category = (body.category || '前日レポート') as NotificationCategory;
    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    const staffName = body.staffName ? String(body.staffName).trim() : '';
    const sendLinePush = body.sendLinePush !== false; // 既定 true
    if (!customerId || !title || !text) {
      return NextResponse.json({ error: 'customerId / title / body が必要' }, { status: 400 });
    }
    const customer = await getCustomer(customerId);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) {
      return NextResponse.json({ error: '顧客のLINEユーザーID が未登録' }, { status: 400 });
    }
    const notification = await createNotification({
      lineUserId: customer.lineUserId,
      customerName: customer.name,
      category,
      title,
      body: text,
      staffName: staffName || undefined,
    });
    let pushed: { pushed: boolean; reason?: string } = { pushed: false, reason: 'skipped' };
    if (sendLinePush) {
      pushed = await pushLineMessage(customer.lineUserId, title, text, staffName || undefined);
    }
    return NextResponse.json({ ok: true, notification, push: pushed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
