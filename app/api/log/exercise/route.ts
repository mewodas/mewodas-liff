import { NextRequest, NextResponse } from 'next/server';
import { invalidate } from '@/lib/cache';
import { getCustomerByLineId } from '@/lib/notion';
import { setExerciseFlagOnDate } from '@/lib/repository/exerciseLogs';
import { withLiffTenant } from '@/lib/withTenant';

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

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { date, exercised, content } = body;

    if (!date || typeof exercised !== 'boolean') {
      return NextResponse.json(
        { error: 'date, exercised(bool) が必要です' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(verifiedLineUserId).catch(() => null);
    const customerName = customer?.name ?? '';

    // 表示の真実のソースは運動ログDB（/api/extras・/api/history・/api/predict-weight・admin分析が参照）。
    // これを必須の書き込みとし、GAS（旧 mewodas スプレッドシート連携・個人シートミラー）はベスト
    // エフォート。自己登録・他テナント顧客は GAS シートに存在せず「顧客が見つかりません」を返すが、
    // それで保存全体を失敗させない（運動は DB に正しく保存され各画面に反映される）。
    // ※体重保存 /api/log/weight と同じ「DB必須・GASミラー」設計に揃える。
    const [dbResult, gasResult] = await Promise.allSettled([
      setExerciseFlagOnDate({
        lineUserId: verifiedLineUserId,
        customerName,
        date,
        exercised,
        content: content || '',
      }),
      callGasSaveExercise({
        lineUserId: verifiedLineUserId,
        date,
        exercised,
        content: content || '',
      }),
    ]);

    if (gasResult.status === 'rejected') {
      console.error('GAS運動ミラー書き込み失敗（無視して継続）:', gasResult.reason);
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
