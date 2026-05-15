import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, getDailyExtras, isoToJpMd } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 個人シートの体重・運動データを取得（Notionブロック走査で重いので /api/today から分離）
export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    const date = req.nextUrl.searchParams.get('date');
    if (!lineUserId || !date) {
      return NextResponse.json({ error: 'lineUserId と date が必要' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }
    const customer = await getCustomerByLineId(lineUserId);
    if (!customer || !customer.foodSheetPageId) {
      return NextResponse.json({ weight: '', exercised: '', exerciseContent: '' });
    }
    const extras = await Promise.race([
      getDailyExtras(customer.foodSheetPageId, isoToJpMd(date)).catch(() => ({
        weight: '',
        exercised: '',
        exerciseContent: '',
      })),
      new Promise<{ weight: string; exercised: string; exerciseContent: string }>(
        (resolve) => setTimeout(() => resolve({ weight: '', exercised: '', exerciseContent: '' }), 10_000)
      ),
    ]);
    const res = NextResponse.json(extras);
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
