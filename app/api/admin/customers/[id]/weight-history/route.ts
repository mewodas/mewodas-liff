import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { getRangeExtras } from '@/lib/notion';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function addDays(dateString: string, n: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isoToJpLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}月${d}日`;
}

export const GET = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 30));
    const today = jstToday();
    const from = addDays(today, -days + 1);

    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });

    if (!customer.foodSheetPageId) {
      return NextResponse.json({
        weights: [],
        targetWeight: customer.targetWeight,
        currentWeight: customer.currentWeight,
        warning: '個人シート未設定のため体重データを取得できません',
      });
    }

    // 日付ラベル生成（getRangeExtras は「M月D日」形式を受け取る）
    const dateLabels: string[] = [];
    const isoList: string[] = [];
    for (let i = 0; i < days; i++) {
      const iso = addDays(from, i);
      isoList.push(iso);
      dateLabels.push(isoToJpLabel(iso));
    }

    const extras = await getRangeExtras(customer.foodSheetPageId, dateLabels);

    const weights = isoList.map((iso, i) => {
      const label = dateLabels[i];
      const ex = extras[label];
      const w = ex?.weight ? parseFloat(ex.weight) : null;
      return {
        date: iso,
        weight: Number.isFinite(w) ? w : null,
        exercised: ex?.exercised || false,
        exerciseContent: ex?.exerciseContent || '',
      };
    });

    return NextResponse.json({
      weights,
      targetWeight: customer.targetWeight,
      currentWeight: customer.currentWeight,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
