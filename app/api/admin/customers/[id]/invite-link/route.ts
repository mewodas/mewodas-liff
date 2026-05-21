import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 招待リンク方式は廃止。テナント共通の申し込みフォーム（/home/register）に移行済み。
export async function POST() {
  return NextResponse.json(
    { error: '招待リンク方式は廃止されました。申し込みフォーム（/home/register）をご利用ください。' },
    { status: 410 }
  );
}
