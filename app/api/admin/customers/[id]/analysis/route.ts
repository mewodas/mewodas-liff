import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listRecordsInRange } from '@/lib/repository/records';
import { generateCoachingAnalysis } from '@/lib/gemini';
import { withAdminTenant } from '@/lib/withTenant';
import { aggregateRecords, normalizeRange } from '@/lib/analysisAggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export const POST = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const today = jstToday();

    // from/to を受け付ける（後方互換: body.days のみの場合は従来通り today 基準で計算）
    let rawFrom: string;
    let rawTo: string;
    if (body.from && body.to) {
      rawFrom = body.from;
      rawTo = body.to;
    } else {
      const days = Math.min(60, Math.max(1, Number(body.days) || 30));
      rawFrom = addDays(today, -days + 1);
      rawTo = today;
    }
    const { from, to } = normalizeRange(rawFrom, rawTo, today);

    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) return NextResponse.json({ error: 'lineUserId 未登録' }, { status: 400 });

    const records = await listRecordsInRange(customer.lineUserId, from, to);
    const agg = aggregateRecords(records, from, to);
    const days = agg.daily.length;
    const rangeLabel = `${from} 〜 ${to}（${days}日間）`;

    if (agg.totalDays === 0) {
      return NextResponse.json({
        analysis: null,
        message: '期間内に食事記録がないため分析を実行できません',
        rangeLabel,
      });
    }

    const analysis = await generateCoachingAnalysis({
      customerName: customer.name,
      goals: customer.goals,
      currentWeight: customer.currentWeight,
      targetWeight: customer.targetWeight,
      targetDate: customer.targetDate,
      recordsSummary: agg.recordsSummary,
      rangeLabel,
      foodList: agg.top20Foods || undefined,
    });

    return NextResponse.json({ analysis, rangeLabel });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
