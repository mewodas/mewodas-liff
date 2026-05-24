import { NextRequest, NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/inviteToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 招待トークンを検証して tenantId を返す公開エンドポイント
// LIFF 起動時のフロントがこのエンドポイントで tenant を解決し localStorage に保存する。
// 認証不要（トークン署名が認証の役割）。
export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const token = String(body.token || '').trim();
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 });

  const payload = verifyInviteToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 400 });
  }

  return NextResponse.json({
    tenantId: payload.tenantId,
    expiresAt: payload.exp,
    kind: payload.kind,
  });
}
