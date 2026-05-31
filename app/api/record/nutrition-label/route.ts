import { NextRequest, NextResponse } from 'next/server';
import { analyzeNutritionLabel } from '@/lib/gemini';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// 認証必須（LINE IDトークン）。無認証だと Gemini API コストを外部から無制限に消費されるため、
// 他の AI ルート（analyze/chat/meal-plan）と同様に withLiffTenant で保護する。
// 呼び出し元（app/record/page.tsx）は apiFetch 経由で Bearer を自動付与済み。
export const POST = withLiffTenant(async (req: NextRequest) => {
  try {
    const form = await req.formData();
    const files = form.getAll('photo') as File[];
    if (!files || files.length === 0) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }

    const images = await Promise.all(
      files.slice(0, 3).map(async (f) => {
        const buf = Buffer.from(await f.arrayBuffer());
        return { base64: buf.toString('base64'), mimeType: f.type || 'image/jpeg' };
      })
    );

    const result = await analyzeNutritionLabel(images);
    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
