import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByLineId,
  getFoodRecordsByDate,
  getTargetDate,
  getDailyExtras,
} from '@/lib/notion';
import { generateMealPlan } from '@/lib/gemini';
import { estimateExercise } from '@/lib/exerciseEstimate';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type ReferenceMenuItem = {
  name: string;
  unit?: string;
  kcal?: number;
  P?: number;
  F?: number;
  C?: number;
  useCount?: number;
};

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const body = await req.json();
    const {
      dietType,
      avoidIngredients,
      preferIngredients,
      budget,
      cookTime,
      mode, // 'remaining' | 'full' | 'one_meal'
      oneMealType, // mode='one_meal' のみ：朝食/昼食/夕食/間食
      referenceMenu, // マイメニュー（クライアントlocalStorageから）
      ingredients, // 顧客が選んだ材料リスト（任意）
    } = body;

    const customer = await getCustomerByLineId(verifiedLineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    // 今日の食事記録を取得して残りPFCを計算
    const todayStr = getTargetDate('今日');
    const todayRecords = await getFoodRecordsByDate(verifiedLineUserId, todayStr).catch(() => []);
    const eaten = todayRecords.reduce(
      (acc, r) => ({
        kcal: acc.kcal + (r.kcal || 0),
        P: acc.P + (r.P || 0),
        F: acc.F + (r.F || 0),
        C: acc.C + (r.C || 0),
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );
    // 運動消費カロリーを取得（個人シートから）
    let exerciseBurn = 0;
    let exerciseContent = '';
    try {
      if (customer.foodSheetPageId) {
        const extras = await getDailyExtras(customer.foodSheetPageId, todayStr);
        exerciseContent = extras.exerciseContent || '';
        if (extras.exercised === '✅' && exerciseContent) {
          const est = estimateExercise(exerciseContent, customer.currentWeight);
          exerciseBurn = est.totalKcal;
        }
      }
    } catch {
      // 失敗は黙殺
    }

    const remaining = {
      kcal: Math.max(0, customer.goals.kcal - eaten.kcal + exerciseBurn),
      P: Math.max(0, customer.goals.P - eaten.P),
      F: Math.max(0, customer.goals.F - eaten.F),
      C: Math.max(0, customer.goals.C - eaten.C),
    };

    // 既に食べた料理名（重複参考用）
    const eatenItems = todayRecords
      .map((r) => r.memo || r.title)
      .filter(Boolean)
      .slice(0, 12);

    // マイメニュー（よく使う順に上位8件まで）
    const refMenu: ReferenceMenuItem[] = Array.isArray(referenceMenu)
      ? (referenceMenu as ReferenceMenuItem[])
          .filter((it) => it && typeof it.name === 'string')
          .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
          .slice(0, 8)
      : [];

    // 使用モード：
    //   remaining = 残りPFCに合わせて3案
    //   one_meal = 指定の食事区分1食分を3案
    //   full = 1日分（4食）まるごと
    // 残りkcalが目標の95%以上ある場合は自動的に full（記録ゼロに近いため意味なし）
    let resolvedMode: 'remaining' | 'full' | 'one_meal' =
      mode === 'full' || mode === 'one_meal' ? mode : 'remaining';
    if (resolvedMode === 'remaining' && remaining.kcal >= customer.goals.kcal * 0.95) {
      resolvedMode = 'full';
    }
    const validMealTypes = ['朝食', '昼食', '夕食', '間食'];
    const targetMealType =
      resolvedMode === 'one_meal' && typeof oneMealType === 'string' && validMealTypes.includes(oneMealType)
        ? (oneMealType as '朝食' | '昼食' | '夕食' | '間食')
        : undefined;

    const cleanIngredients: string[] = Array.isArray(ingredients)
      ? (ingredients as unknown[])
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0)
          .slice(0, 20)
      : [];

    const plan = await generateMealPlan({
      goals: customer.goals,
      remaining,
      eaten,
      eatenItems,
      mode: resolvedMode,
      targetMealType,
      profile: {
        currentWeight: customer.currentWeight,
        targetWeight: customer.targetWeight,
        targetDate: customer.targetDate,
      },
      referenceMenu: refMenu,
      ingredients: cleanIngredients,
      preferences: {
        dietType: dietType || '通常',
        avoidIngredients: avoidIngredients || '',
        preferIngredients: preferIngredients || '',
        budget: budget || '通常',
        cookTime: cookTime || '通常',
      },
    });

    return NextResponse.json({
      plan,
      customerName: customer.name,
      goals: customer.goals,
      eaten,
      remaining,
      exerciseBurn,
      exerciseContent,
      mode: resolvedMode,
      targetMealType,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
