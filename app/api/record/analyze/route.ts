import { NextRequest, NextResponse } from 'next/server';
import { analyzeImagesPfc, analyzeTextPfc } from '@/lib/gemini';
import { getCustomerByLineId } from '@/lib/notion';
import { getCurrentTenant } from '@/lib/tenant';
import { getTenantByIdAsync, getApplicableCalibration } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export type AnalyzedItem = {
  index: number;
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
    let comment = '';
    let previousItems: Array<{ name: string; P: number; F: number; C: number }> | null = null;
    const images: Array<{ base64: string; mimeType: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      lineUserId = String(formData.get('lineUserId') || '');
      comment = String(formData.get('comment') || '');
      const prev = formData.get('previousItems');
      if (typeof prev === 'string' && prev.trim()) {
        try {
          previousItems = JSON.parse(prev);
        } catch {
          previousItems = null;
        }
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
      comment = body.comment || '';
      previousItems = body.previousItems || null;
    }

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }
    const supplementText = comment.trim();
    if (images.length === 0 && !supplementText) {
      return NextResponse.json(
        { error: '写真かメモのどちらかは入力してください' },
        { status: 400 }
      );
    }

    // テナント別 PFC キャリブレーション係数を解決
    const ctxTenant = getCurrentTenant();
    const fullTenant = await getTenantByIdAsync(ctxTenant.id).catch(() => null);
    const calibration = getApplicableCalibration(fullTenant ?? ctxTenant);

    const [customer, pfc] = await Promise.all([
      getCustomerByLineId(lineUserId),
      images.length > 0
        ? analyzeImagesPfc(images, supplementText || null, previousItems, calibration)
        : analyzeTextPfc(supplementText, calibration),
    ]);

    if (!customer || customer.foodStatus !== '進行中') {
      return NextResponse.json(
        { error: '食事管理サービス対象外、またはステータスが進行中ではありません' },
        { status: 400 }
      );
    }

    // 各itemにkcal（Atwater係数 P*4 + F*9 + C*4）と index を付与
    const rawItems = pfc.items || [];
    const items: AnalyzedItem[] = rawItems.map((it, i) => {
      const kcal = Math.round(it.P * 4 + it.F * 9 + it.C * 4);
      return {
        index: i + 1,
        name: it.name || `食材${i + 1}`,
        kcal,
        P: Math.round(it.P * 10) / 10,
        F: Math.round(it.F * 10) / 10,
        C: Math.round(it.C * 10) / 10,
      };
    });

    // items が空の場合は全体PFCを1つの食事として返す
    if (items.length === 0) {
      items.push({
        index: 1,
        name: supplementText || '解析した食事',
        kcal: pfc.kcal,
        P: pfc.P,
        F: pfc.F,
        C: pfc.C,
      });
    }

    return NextResponse.json({
      items,
      total: {
        kcal: pfc.kcal,
        P: pfc.P,
        F: pfc.F,
        C: pfc.C,
      },
      details: pfc.details || null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
