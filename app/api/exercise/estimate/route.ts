import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId } from '@/lib/notion';
import { estimateExercise } from '@/lib/exerciseEstimate';

export const runtime = 'nodejs';
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// 運動消費カロリー推定（ルールベース・AI不使用）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, content } = body;
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content が必要です' }, { status: 400 });
    }

    let weight: number | null = null;
    if (lineUserId) {
      try {
        const customer = await getCustomerByLineId(lineUserId);
        if (customer?.currentWeight && customer.currentWeight > 0) {
          weight = customer.currentWeight;
        }
      } catch {
        // 顧客取得失敗時はデフォルト体重で推定
      }
    }

    const estimate = estimateExercise(content, weight);
    return NextResponse.json({ estimate, weight });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
