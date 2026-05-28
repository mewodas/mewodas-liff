// プレビュートークン発行 API（admin 認証必須）
//
// セキュリティ要点:
//   - tenantId は入力からではなく認証セッション（getCurrentTenant）から取得
//   - 対象顧客がそのテナントに属することをサーバーで検証
//   - 発行されるトークンは kind:'preview', exp:60分

import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';
import { listCustomers } from '@/lib/repository/customers';
import { generatePreviewToken } from '@/lib/demoSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminTenant(async (req: NextRequest) => {
  const tenant = getCurrentTenant();
  let body: { lineUserId?: string; customerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { lineUserId, customerId } = body;
  if (!lineUserId && !customerId) {
    return NextResponse.json({ error: 'lineUserId または customerId が必要です' }, { status: 400 });
  }

  // 顧客がこのテナントに属することを検証
  const customers = await listCustomers({ noCache: true });
  let targetLineUserId: string | null = null;

  if (lineUserId) {
    const found = customers.find((c) => c.lineUserId === lineUserId);
    if (!found) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }
    targetLineUserId = found.lineUserId;
  } else if (customerId) {
    const found = customers.find((c) => c.pageId === customerId);
    if (!found) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }
    if (!found.lineUserId) {
      return NextResponse.json({ error: 'LINE未連携の顧客はプレビューできません' }, { status: 400 });
    }
    targetLineUserId = found.lineUserId;
  }

  if (!targetLineUserId) {
    return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
  }

  const token = generatePreviewToken({ tenantId: tenant.id, lineUserId: targetLineUserId });
  return NextResponse.json({ token, tenantId: tenant.id, lineUserId: targetLineUserId });
});
