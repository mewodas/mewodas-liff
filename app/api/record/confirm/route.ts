import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getCustomerByLineId, saveFoodRecord, getTargetDate } from '@/lib/notion';
import { saveImagesToDriveAsync } from '@/lib/drive';
import { withLiffTenant } from '@/lib/withTenant';

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

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    let day = '';
    let mealType = '';
    let comment = '';
    let items: ItemPayload[] = [];
    const images: Array<{ base64: string; mimeType: string }> = [];

    let date = '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      day = String(formData.get('day') || '');
      date = String(formData.get('date') || '');
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
      day = body.day || '';
      date = body.date || '';
      mealType = body.mealType || '';
      comment = body.comment || '';
      items = Array.isArray(body.items) ? body.items : [];
    }

    if (!mealType) {
      return NextResponse.json({ error: 'mealType は必須です' }, { status: 400 });
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

    const customer = await getCustomerByLineId(verifiedLineUserId);
    if (!customer || customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 400 }
      );
    }

    const totals = items.reduce(
      (acc, it) => ({
        kcal: acc.kcal + (it.kcal || 0),
        P: acc.P + (it.P || 0),
        F: acc.F + (it.F || 0),
        C: acc.C + (it.C || 0),
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );

    const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getTargetDate(day || '今日');
    const trimmedComment = comment.trim() || null;

    const beforeDedup = items.length;
    items = items.filter((it, idx) => {
      const name = String(it.name || '');
      if (!name) return false;
      let containsCount = 0;
      for (let j = 0; j < items.length; j++) {
        if (j === idx) continue;
        const other = String(items[j].name || '');
        if (other && other.length >= 2 && name !== other && name.includes(other)) {
          containsCount++;
        }
      }
      return containsCount < 2;
    });
    if (items.length !== beforeDedup) {
      console.log(`[record/confirm] dedup: ${beforeDedup} → ${items.length} items`);
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'すべてのitemsが除外されました（重複検出）' }, { status: 400 });
    }

    const saveResults = await Promise.all(
      items.map((it, idx) =>
        saveFoodRecord({
          customerName: customer.name,
          lineUserId: verifiedLineUserId,
          pfc: {
            kcal: Math.round(it.kcal || 0),
            P: Math.round((it.P || 0) * 10) / 10,
            F: Math.round((it.F || 0) * 10) / 10,
            C: Math.round((it.C || 0) * 10) / 10,
            items: [{ name: it.name }],
          },
          mealType,
          goals: customer.goals,
          targetDate,
          supplementText: idx === 0 ? trimmedComment : null,
        })
      )
    );

    const firstRecord = saveResults[0];
    if (images.length > 0 && firstRecord && firstRecord.id) {
      const allPageIds = saveResults
        .map((r) => r?.id)
        .filter((id): id is string => typeof id === 'string');
      waitUntil(
        saveImagesToDriveAsync({
          notionPageId: firstRecord.id,
          notionPageIds: allPageIds,
          customerName: customer.name,
          lineUserId: verifiedLineUserId,
          photos: images,
        })
      );
    }

    const pfc = {
      kcal: Math.round(totals.kcal),
      P: Math.round(totals.P * 10) / 10,
      F: Math.round(totals.F * 10) / 10,
      C: Math.round(totals.C * 10) / 10,
      items: items.map((it) => ({ name: it.name, P: it.P, F: it.F, C: it.C })),
    };

    return NextResponse.json({ ok: true, pfc, recordCount: saveResults.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
