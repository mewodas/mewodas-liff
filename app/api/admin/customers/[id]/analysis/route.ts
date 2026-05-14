import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listRecordsInRange } from '@/lib/repository/records';
import { generateCoachingAnalysis } from '@/lib/gemini';
import { withAdminTenant } from '@/lib/withTenant';

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
    const days = Math.min(60, Math.max(7, Number(body.days) || 30));
    const today = jstToday();
    const from = addDays(today, -days + 1);

    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) return NextResponse.json({ error: 'lineUserId 未登録' }, { status: 400 });

    const records = await listRecordsInRange(customer.lineUserId, from, today);

    // 日別集計
    const byDay = new Map<string, { kcal: number; P: number; F: number; C: number; count: number; meals: string[] }>();
    for (const r of records) {
      const cur = byDay.get(r.date) || { kcal: 0, P: 0, F: 0, C: 0, count: 0, meals: [] };
      cur.kcal += r.kcal;
      cur.P += r.P;
      cur.F += r.F;
      cur.C += r.C;
      cur.count += 1;
      const item = (r.memo || r.title || '').split(/\s*\/\s*AI識別[:：]/)[0]?.trim().slice(0, 50);
      if (item) cur.meals.push(`${r.mealType}:${item}`);
      byDay.set(r.date, cur);
    }
    const sorted = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const totalDays = sorted.length;
    const sum = sorted.reduce(
      (acc, [, v]) => ({
        kcal: acc.kcal + v.kcal,
        P: acc.P + v.P,
        F: acc.F + v.F,
        C: acc.C + v.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );
    const avg = totalDays > 0
      ? {
          kcal: Math.round(sum.kcal / totalDays),
          P: Math.round((sum.P / totalDays) * 10) / 10,
          F: Math.round((sum.F / totalDays) * 10) / 10,
          C: Math.round((sum.C / totalDays) * 10) / 10,
        }
      : { kcal: 0, P: 0, F: 0, C: 0 };

    // テキストサマリー生成（LLM に渡す）
    const lines: string[] = [];
    lines.push(`記録日数: ${totalDays}/${days}日`);
    lines.push(
      `平均: ${avg.kcal}kcal / P${avg.P}g / F${avg.F}g / C${avg.C}g（記録日平均）`
    );
    lines.push('');
    lines.push('日別:');
    for (const [date, v] of sorted.slice(-21)) {
      const sample = v.meals.slice(0, 4).join('、') || '記録なし';
      lines.push(
        `${date} (${v.count}食): ${Math.round(v.kcal)}kcal P${Math.round(v.P)} F${Math.round(v.F)} C${Math.round(v.C)} — ${sample}`
      );
    }
    const recordsSummary = lines.join('\n');

    const rangeLabel = `${from} 〜 ${today}（${days}日間）`;

    // 日別データ（チャート用）— 期間内の全日を埋めて、記録なしは null
    const daily: Array<{ date: string; kcal: number | null; P: number | null; F: number | null; C: number | null; count: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      const v = byDay.get(d);
      daily.push({
        date: d,
        kcal: v ? Math.round(v.kcal) : null,
        P: v ? Math.round(v.P * 10) / 10 : null,
        F: v ? Math.round(v.F * 10) / 10 : null,
        C: v ? Math.round(v.C * 10) / 10 : null,
        count: v ? v.count : 0,
      });
    }

    const target = {
      currentWeight: customer.currentWeight,
      targetWeight: customer.targetWeight,
      targetDate: customer.targetDate,
    };

    if (totalDays === 0) {
      return NextResponse.json({
        analysis: null,
        message: '期間内に食事記録がないため分析を実行できません',
        rangeLabel,
        stats: { totalDays, avg, sum: { ...sum, kcal: Math.round(sum.kcal) } },
        daily,
        goals: customer.goals,
        target,
      });
    }

    const analysis = await generateCoachingAnalysis({
      customerName: customer.name,
      goals: customer.goals,
      currentWeight: customer.currentWeight,
      targetWeight: customer.targetWeight,
      targetDate: customer.targetDate,
      recordsSummary,
      rangeLabel,
    });

    return NextResponse.json({
      analysis,
      rangeLabel,
      stats: { totalDays, avg, sum: { ...sum, kcal: Math.round(sum.kcal) } },
      daily,
      goals: customer.goals,
      target,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
