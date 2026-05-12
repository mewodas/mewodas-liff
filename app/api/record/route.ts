import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { analyzeImagesPfc, analyzeTextPfc } from '@/lib/gemini';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';
import { saveImagesToDriveAsync } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let lineUserId = '';
    let day = '';
    let mealType = '';
    let comment = '';
    const images: Array<{ base64: string; mimeType: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      // FormData形式（新クライアント）
      const formData = await req.formData();
      lineUserId = String(formData.get('lineUserId') || '');
      day = String(formData.get('day') || '');
      mealType = String(formData.get('mealType') || '');
      comment = String(formData.get('comment') || '');
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('photo_') && value instanceof File) {
          const buf = Buffer.from(await value.arrayBuffer());
          images.push({
            base64: buf.toString('base64'),
            mimeType: value.type || 'image/jpeg',
          });
        }
      }
    } else {
      // 旧JSON形式との互換性
      const body = await req.json();
      lineUserId = body.lineUserId || '';
      day = body.day || '';
      mealType = body.mealType || '';
      comment = body.comment || '';
      if (Array.isArray(body.photos)) {
        images.push(...body.photos);
      } else if (body.photoBase64) {
        images.push({
          base64: body.photoBase64,
          mimeType: body.mimeType || 'image/jpeg',
        });
      }
    }

    if (!lineUserId || !mealType) {
      return NextResponse.json({ error: 'lineUserId と mealType は必須です' }, { status: 400 });
    }
    const supplementText = comment.trim();
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
    const notionRes = await saveFoodRecord({
      customerName: customer.name,
      lineUserId,
      pfc,
      mealType,
      goals: customer.goals,
      targetDate,
      supplementText: supplementText || null,
    });

    // Drive保存はレスポンス後に非同期実行
    if (images.length > 0 && notionRes && notionRes.id) {
      waitUntil(
        saveImagesToDriveAsync({
          notionPageId: notionRes.id,
          customerName: customer.name,
          lineUserId,
          photos: images,
        })
      );
    }

    return NextResponse.json({ ok: true, pfc });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
