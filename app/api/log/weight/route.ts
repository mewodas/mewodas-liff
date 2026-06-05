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

    // 表示の真実のソースは Notion 体重ログDB（/api/today が getLatestWeight で参照）。
    // これを必須の書き込みとし、GAS（旧 mewodas スプレッドシート連携）はベストエフォートの
    // ミラーにする。自己登録顧客・mewodas 以外のテナント顧客は GAS シートに存在せず
    // 「顧客が見つかりません」を返すが、それで保存全体を失敗させない（体重は DB に正しく
    // 保存されホームにも反映される）。※運動保存ルート /api/exercise-log と同じ「顧客未検出
    // でも保存する」設計に揃える。
    const [dbResult, gasResult] = await Promise.allSettled([
      createWeightLog({
        lineUserId: verifiedLineUserId,
        customerName,
        date,
        weightKg: weight,
        source: 'LIFF',
      }),
      callGasSaveWeight({ lineUserId: verifiedLineUserId, date, weight }),
    ]);

    if (gasResult.status === 'rejected') {
      console.error('GAS体重ミラー書き込み失敗（無視して継続）:', gasResult.reason);
    }
    if (dbResult.status === 'rejected') {
      throw dbResult.reason;
    }

    invalidate('');

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
