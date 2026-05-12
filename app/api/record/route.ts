import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, day, mealType, comment, photoBase64, mimeType } = body;

    if (!lineUserId || !mealType || !photoBase64) {
      return NextResponse.json({ error: '必須項目が不足' }, { status: 400 });
    }

    const gasEndpoint = process.env.GAS_RECORD_ENDPOINT;
    if (!gasEndpoint) {
      return NextResponse.json({ error: 'GAS_RECORD_ENDPOINT 未設定' }, { status: 500 });
    }

    const gasRes = await fetch(gasEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'liff_record',
        lineUserId,
        day,
        mealType,
        comment: comment || '',
        photoBase64,
        mimeType: mimeType || 'image/jpeg',
      }),
    });

    if (!gasRes.ok) {
      const text = await gasRes.text();
      return NextResponse.json({ error: 'GAS呼び出し失敗', detail: text.slice(0, 300) }, { status: 502 });
    }

    const data = await gasRes.json();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
