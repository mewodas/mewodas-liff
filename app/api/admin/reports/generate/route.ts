import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/repository/customers';
import { listRecordsInRange } from '@/lib/repository/records';
import { getTemplate, DEFAULT_TEMPLATES, isTemplatesConfigured } from '@/lib/templates';
import { getStaff } from '@/lib/staff';
import { getStoreByStoreId } from '@/lib/stores';
import { generateCoachingAnalysis, generateReportComments } from '@/lib/gemini';
import { withAdminTenant } from '@/lib/withTenant';
import { buildReportVariables } from '@/lib/reports/variables';
import { resolveDateRange } from '@/lib/reports/dateRange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export const POST = withAdminTenant(async (req) => {
  try {
    const body = await req.json();
    const customerId = String(body.customerId || '');
    const templateId = String(body.templateId || '');
    const staffId = body.staffId ? String(body.staffId) : '';
    const manualStart = String(body.startDate || '').trim();
    const manualEnd = String(body.endDate || '').trim();
    if (!customerId) {
      return NextResponse.json({ error: 'customerId 必須' }, { status: 400 });
    }
    const [customer, template, staff] = await Promise.all([
      getCustomer(customerId),
      templateId
        ? isTemplatesConfigured()
          ? getTemplate(templateId)
          : Promise.resolve(DEFAULT_TEMPLATES.find((t) => t.id === templateId) || null)
        : Promise.resolve(null),
      staffId ? getStaff(staffId) : Promise.resolve(null),
    ]);

    // テンプレの rangeType に基づいて期間を決定（手動指定があれば手動優先）
    const hasManualRange = manualStart && manualEnd;
    const { startDate, endDate, rangeLabel: resolvedRangeLabel } = resolveDateRange(
      hasManualRange ? 'カスタム' : template?.rangeType,
      hasManualRange ? { startDate: manualStart, endDate: manualEnd } : undefined
    );
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate / endDate を特定できませんでした' }, { status: 400 });
    }
    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 });
    if (!customer.lineUserId) return NextResponse.json({ error: 'lineUserId 未登録' }, { status: 400 });

    // 期間内の食事記録を先に取得（変数置換でも使うため、static body 分岐の前に実行）
    const records = await listRecordsInRange(customer.lineUserId, startDate, endDate);

    // 日別集計（AI レポート用サマリ生成に使用）
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
      (acc, [, v]) => ({ kcal: acc.kcal + v.kcal, P: acc.P + v.P, F: acc.F + v.F, C: acc.C + v.C }),
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

    // 顧客の所属店舗を取得（署名・店舗名変数用）
    const store = customer.storeId ? await getStoreByStoreId(customer.storeId).catch(() => null) : null;

    const isSingleDay = startDate === endDate;
    const showKcal = isSingleDay ? Math.round(sum.kcal) : avg.kcal;
    const showP = isSingleDay ? Math.round(sum.P * 10) / 10 : avg.P;
    const showF = isSingleDay ? Math.round(sum.F * 10) / 10 : avg.F;
    const showC = isSingleDay ? Math.round(sum.C * 10) / 10 : avg.C;

    // 全変数を構築（食事区分別を含む）
    const vars: Record<string, string> = {
      ...buildReportVariables(records, customer, store, { startDate, endDate, isSingleDay }),
      staff: staff?.name || '',
      shop: staff?.shop || '',
      rangeLabel: resolvedRangeLabel,
    };

    const title = template?.titleTemplate ? applyVars(template.titleTemplate, vars) : (template?.name || 'レポート');

    // 静的本文 → 変数置換 + AI コメント補完
    if (template && !template.useAi) {
      let body = applyVars(template.bodyTemplate, vars);
      // {ai_*} 形式の AI コメント変数を検出して個別に AI で生成
      const aiVarRegex = /\{(ai_\w+)\}/g;
      const aiVars = new Set<string>();
      let m;
      while ((m = aiVarRegex.exec(body)) !== null) aiVars.add(m[1]);

      let aiComments: Record<string, string> = {};
      if (aiVars.size > 0) {
        const mealItems = records.map((r) => ({
          mealType: r.mealType,
          name: (r.memo || r.title || '').split(/\s*\/\s*AI識別[:：]/)[0]?.trim().slice(0, 50),
        })).filter((item) => item.name);
        try {
          aiComments = await generateReportComments({
            customerName: customer.name,
            date: endDate,
            sum: { kcal: showKcal, P: showP, F: showF, C: showC },
            goals: customer.goals,
            currentWeight: customer.currentWeight,
            targetWeight: customer.targetWeight,
            requiredKeys: Array.from(aiVars),
            mealItems,
          });
        } catch (e) {
          // AI 失敗時はプレースホルダのまま残す（送信時に手動で書き換え可）
          console.error('[reports/generate] AI comment failed:', e instanceof Error ? e.message : 'unknown');
        }
        // AI コメントで置換
        body = body.replace(/\{(ai_\w+)\}/g, (_, k) => aiComments[k] ?? `{${k}}`);
      }

      return NextResponse.json({
        title,
        body,
        usedAi: aiVars.size > 0,
        stats: { totalDays, avg, sum: { ...sum, kcal: Math.round(sum.kcal) } },
      });
    }

    const lines: string[] = [];
    lines.push(`記録日数: ${totalDays}/${diffDays(startDate, endDate)}日`);
    lines.push(`平均: ${avg.kcal}kcal / P${avg.P}g / F${avg.F}g / C${avg.C}g`);
    lines.push('');
    lines.push('日別:');
    for (const [date, v] of sorted.slice(-14)) {
      const sample = v.meals.slice(0, 4).join('、') || '記録なし';
      lines.push(
        `${date} (${v.count}食): ${Math.round(v.kcal)}kcal P${Math.round(v.P)} F${Math.round(v.F)} C${Math.round(v.C)} — ${sample}`
      );
    }
    const recordsSummary = lines.join('\n');
    const rangeLabel = resolvedRangeLabel;

    if (totalDays === 0) {
      return NextResponse.json({
        title,
        body: '期間内に食事記録がないため、AIレポートを生成できません。',
        usedAi: false,
        stats: { totalDays, avg, sum: { ...sum, kcal: Math.round(sum.kcal) } },
      });
    }

    // テンプレ本文がある場合は AI に「これをベースに不足部分を実データで補完して」と指示
    const templateContext: string[] = [];
    if (template?.aiPrompt) {
      templateContext.push(`【トレーナーからの追加指示】\n${template.aiPrompt}`);
    }
    if (template?.bodyTemplate) {
      templateContext.push(
        `【ベース文面（この構成を尊重し、空欄や曖昧な部分を実データで埋める）】\n${template.bodyTemplate}`
      );
    }
    const augmentedSummary = templateContext.length
      ? `${templateContext.join('\n\n')}\n\n【期間の記録データ】\n${recordsSummary}`
      : recordsSummary;

    const analysis = await generateCoachingAnalysis({
      customerName: customer.name,
      goals: customer.goals,
      currentWeight: customer.currentWeight,
      targetWeight: customer.targetWeight,
      targetDate: customer.targetDate,
      recordsSummary: augmentedSummary,
      rangeLabel,
    });

    let bodyText = analysis.reportDraft || analysis.summary;
    if (staff?.name) {
      bodyText = bodyText + `\n\n— ${staff.shop ? `${staff.shop} ` : ''}${staff.name}`;
    }

    return NextResponse.json({
      title,
      body: bodyText,
      usedAi: true,
      analysis,
      stats: { totalDays, avg, sum: { ...sum, kcal: Math.round(sum.kcal) } },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

function diffDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}
