import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 招待トークン方式は廃止。自己登録方式（/api/liff/register）に移行済み。
export async function POST() {
  return NextResponse.json(
    { error: '招待トークン方式は廃止されました。新しい申し込みフォームをご利用ください。' },
    { status: 410 }
  );
}
