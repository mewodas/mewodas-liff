import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, getDailyExtras, isoToJpMd } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jstTodayStr(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

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
    const isToday = date === jstTodayStr();
    // 今日を見ていて顧客の「現在体重」が顧客DBにあれば、個人シート反映遅延に備えてフォールバック
    const fallbackWeight =
      isToday && customer?.currentWeight !== null && customer?.currentWeight !== undefined
        ? String(customer.currentWeight)
        : '';

    if (!customer || !customer.foodSheetPageId) {
      const res = NextResponse.json({ weight: fallbackWeight, exercised: '', exerciseContent: '' });
      res.headers.set('Cache-Control', 'no-store, must-revalidate');
      return res;
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
    // 個人シートに体重が無くても今日を見ていれば顧客DBの「現在体重」を返す
    // → GAS の体重保存後 /home に即反映される
    if (!extras.weight && fallbackWeight) {
      extras.weight = fallbackWeight;
    }
    const res = NextResponse.json(extras);
    // 体重保存直後にホームを開いた時に古い値を返さないよう、HTTPキャッシュは無効化
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
