import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function callGasSaveExercise(payload: {
  lineUserId: string;
  date: string;
  exercised: boolean;
  content: string;
}): Promise<void> {
  const gasEndpoint = process.env.GAS_RECORD_ENDPOINT;
  if (!gasEndpoint) {
    throw new Error('GAS_RECORD_ENDPOINT 未設定');
  }
  const res = await fetch(gasEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'liff_save_exercise', ...payload }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`GAS保存失敗（${res.status}）: ${detail}`);
  }
  const data = await res.json().catch(() => null);
  if (data && data.ok === false) {
    throw new Error(data.error || 'GAS保存エラー');
  }
}

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

    // GAS書き込み完了を待ってからレスポンス（上書き反映を確実にする）
    await callGasSaveExercise({
      lineUserId,
      date,
      exercised,
      content: content || '',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
