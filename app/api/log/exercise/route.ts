import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, date, exercised, content } = body;

    if (!lineUserId || !date || typeof exercised !== 'boolean') {
      return NextResponse.json(
        { error: 'lineUserId, date, exercised(bool) が必要です' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }

    const gasEndpoint = process.env.GAS_RECORD_ENDPOINT;
    if (!gasEndpoint) {
      return NextResponse.json({ error: 'GAS_RECORD_ENDPOINT 未設定' }, { status: 500 });
    }

    const gasRes = await fetch(gasEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'liff_save_exercise',
        lineUserId,
        date,
        exercised,
        content: content || '',
      }),
    });

    if (!gasRes.ok) {
      return NextResponse.json(
        { error: 'GAS呼び出し失敗', detail: (await gasRes.text()).slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await gasRes.json();
    if (data && data.ok === false) {
      return NextResponse.json({ error: data.error || 'GAS処理失敗' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
