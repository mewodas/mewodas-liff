import { NextRequest, NextResponse } from 'next/server';
import { invalidate } from '@/lib/cache';
import { getCustomerByLineId } from '@/lib/notion';
import { createWeightLog } from '@/lib/repository/weightLogs';
import { withLiffTenant } from '@/lib/withTenant';

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

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { date, weight } = body;

    if (!date || typeof weight !== 'number') {
      return NextResponse.json(
        { error: 'date, weight(number) が必要です' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }
    if (weight <= 0 || weight > 300) {
      return NextResponse.json({ error: 'weight が不正です（0〜300kg）' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(verifiedLineUserId).catch(() => null);
    const customerName = customer?.name ?? '';

    const [gasResult] = await Promise.allSettled([
      callGasSaveWeight({ lineUserId: verifiedLineUserId, date, weight }),
      createWeightLog({
        lineUserId: verifiedLineUserId,
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

    invalidate('');

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
