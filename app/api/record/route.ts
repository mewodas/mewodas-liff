import { NextRequest, NextResponse } from 'next/server';
import { analyzeImagesPfc, analyzeTextPfc } from '@/lib/gemini';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  lineUserId?: string;
  day?: string;
  mealType?: string;
  comment?: string;
  // 互換性のため：単一画像 or 配列
  photoBase64?: string;
  mimeType?: string;
  photos?: Array<{ base64: string; mimeType: string }>;
};

export async function POST(req: NextRequest) {
  try {
    const body: Body = await req.json();
    const { lineUserId, day, mealType, comment, photoBase64, mimeType, photos } = body;

    if (!lineUserId || !mealType) {
      return NextResponse.json({ error: 'lineUserId と mealType は必須です' }, { status: 400 });
    }
    const supplementText = (comment || '').trim();

    // 画像の正規化（photos配列 OR 単一photoBase64）
    const images: Array<{ base64: string; mimeType: string }> = [];
    if (Array.isArray(photos) && photos.length > 0) {
      images.push(...photos);
    } else if (photoBase64) {
      images.push({ base64: photoBase64, mimeType: mimeType || 'image/jpeg' });
    }

    if (images.length === 0 && !supplementText) {
      return NextResponse.json(
        { error: '写真かメモのどちらかは入力してください' },
        { status: 400 }
      );
    }

    // 顧客情報取得とPFC解析を並列実行
    const [customer, pfc] = await Promise.all([
      getCustomerByLineId(lineUserId),
      images.length > 0
        ? analyzeImagesPfc(images, supplementText || null)
        : analyzeTextPfc(supplementText),
    ]);

    if (!customer || customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 400 }
      );
    }

    const targetDate = getTargetDate(day);
    await saveFoodRecord({
      customerName: customer.name,
      lineUserId,
      pfc,
      mealType,
      goals: customer.goals,
      targetDate,
      supplementText: supplementText || null,
    });

    return NextResponse.json({ ok: true, pfc });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
