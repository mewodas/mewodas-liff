import { NextRequest, NextResponse } from 'next/server';
import { invalidate } from '@/lib/cache';
import { getCustomerByLineId } from '@/lib/notion';
import { createWeightLog } from '@/lib/repository/weightLogs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function callGasSaveWeight(payload: {
  lineUserId: string;
  date: string;
  weight: number;
}): Promise<void> {
  const gasEndpoint = process.env.GAS_RECORD_ENDPOINT;
  if (!gasEndpoint) {
    throw new Error('GAS_RECORD_ENDPOINT 未設定');
  }
  const res = await fetch(gasEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'liff_save_weight', ...payload }),
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
    const { lineUserId, date, weight } = body;

    if (!lineUserId || !date || typeof weight !== 'number') {
      return NextResponse.json(
        { error: 'lineUserId, date, weight(number) が必要です' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }
    if (weight <= 0 || weight > 300) {
      return NextResponse.json({ error: 'weight が不正です（0〜300kg）' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(lineUserId).catch(() => null);
    const customerName = customer?.name ?? '';

    // GAS（個人シート書き込み）と 新体重DB への書き込みを並列実行
    // GAS 失敗時も新DB には書き込む（フェイルセーフ）
    const [gasResult] = await Promise.allSettled([
      callGasSaveWeight({ lineUserId, date, weight }),
      createWeightLog({
        lineUserId,
        customerName,
        date,
        weightKg: weight,
        source: 'LIFF',
      }).catch((e) => {
        console.error('体重DB書き込み失敗（フェイルセーフ継続）:', e);
      }),
    ]);

    if (gasResult.status === 'rejected') {
      throw gasResult.reason;
    }

    // GAS が顧客DBの「現在体重」を更新したので、Vercel側の顧客キャッシュを
    // 全テナント横断でクリア（次回 /api/today などで fresh な値を取得）
    invalidate('');

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
