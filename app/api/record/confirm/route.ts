import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';
import { saveImagesToDriveAsync } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

type ItemPayload = {
  name: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let lineUserId = '';
    let day = '';
    let mealType = '';
    let comment = '';
    let items: ItemPayload[] = [];
    const images: Array<{ base64: string; mimeType: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      lineUserId = String(formData.get('lineUserId') || '');
      day = String(formData.get('day') || '今日');
      mealType = String(formData.get('mealType') || '');
      comment = String(formData.get('comment') || '');
      const itemsJson = String(formData.get('items') || '[]');
      try {
        items = JSON.parse(itemsJson);
      } catch {
        items = [];
      }
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
      const body = await req.json();
      lineUserId = body.lineUserId || '';
      day = body.day || '今日';
      mealType = body.mealType || '';
      comment = body.comment || '';
      items = Array.isArray(body.items) ? body.items : [];
    }

    if (!lineUserId || !mealType) {
      return NextResponse.json({ error: 'lineUserId と mealType は必須です' }, { status: 400 });
    }
    const validMeals = ['朝食', '昼食', '夕食', '間食'];
    if (!validMeals.includes(mealType)) {
      return NextResponse.json({ error: 'mealType が不正です' }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json(
        { error: '記録する食材を1つ以上選択してください' },
        { status: 400 }
      );
    }

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer || customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 400 }
      );
    }

    // 選択されたアイテムを集計
    const totals = items.reduce(
      (acc, it) => ({
        kcal: acc.kcal + (it.kcal || 0),
        P: acc.P + (it.P || 0),
        F: acc.F + (it.F || 0),
        C: acc.C + (it.C || 0),
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    const pfc = {
      kcal: Math.round(totals.kcal),
      P: Math.round(totals.P * 10) / 10,
      F: Math.round(totals.F * 10) / 10,
      C: Math.round(totals.C * 10) / 10,
      items: items.map((it) => ({
        name: it.name,
        P: it.P,
        F: it.F,
        C: it.C,
      })),
    };

    const targetDate = getTargetDate(day);
    const notionRes = await saveFoodRecord({
      customerName: customer.name,
      lineUserId,
      pfc,
      mealType,
      goals: customer.goals,
      targetDate,
      supplementText: comment.trim() || null,
    });

    // Drive保存は非同期
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
