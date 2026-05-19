import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, getDailyExtras, isoToJpMd } from '@/lib/notion';
import { getWeightOnDate } from '@/lib/repository/weightLogs';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 体重は新体重DBから取得。運動データは引き続き個人シートから。
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

    // 体重は新DBから取得（個人シート走査不要）
    const weightLog = await getWeightOnDate(lineUserId, date).catch(() => null);
    const weightStr = weightLog ? String(weightLog.weightKg) : '';

    // 運動データは引き続き個人シートから
    let exercised = '';
    let exerciseContent = '';
    if (customer?.foodSheetPageId) {
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
      exercised = extras.exercised;
      exerciseContent = extras.exerciseContent;
    }

    const res = NextResponse.json({ weight: weightStr, exercised, exerciseContent });
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
