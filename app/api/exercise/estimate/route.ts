import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId } from '@/lib/notion';
import { estimateExercise } from '@/lib/exerciseEstimate';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// 運動消費カロリー推定（ルールベース・AI不使用）。
// セキュリティ: 旧実装は未認証 POST で body の lineUserId をそのまま使って任意ユーザーの
// currentWeight を返せる「未認証PIIオラクル」だった。withLiffTenant で認証必須にし、
// 体重は検証済み本人(verifiedLineUserId)の値のみを参照する。
export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const { content } = body;
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content が必要です' }, { status: 400 });
    }

    let weight: number | null = null;
    try {
      const customer = await getCustomerByLineId(verifiedLineUserId);
      if (customer?.currentWeight && customer.currentWeight > 0) {
        weight = customer.currentWeight;
      }
    } catch {
      // 顧客取得失敗時はデフォルト体重で推定
    }

    const estimate = estimateExercise(content, weight);
    return NextResponse.json({ estimate, weight });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
