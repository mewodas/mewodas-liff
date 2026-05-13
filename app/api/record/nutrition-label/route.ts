import { NextRequest, NextResponse } from 'next/server';
import { analyzeNutritionLabel } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
}
