import { NextResponse } from 'next/server';
import { getCorrectionRecords } from '@/lib/notion';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// AI推定値 vs 現在値（補正後）の差分を集計するエンドポイント
//
// 使い方：
//   GET /api/admin/corrections?from=2026-05-01&to=2026-05-31&key=ADMIN_KEY
//
// レスポンス：
//   {
//     period: { from, to },
//     totalRecords: number,
//     correctedRecords: number,
//     correctionRate: number, // 0-100%
//     avgDiff: { kcal, P, F, C },           // 平均差分（補正方向）
//     calibrationSuggestion: { P, F, C },   // 推奨キャリブレーション係数
//     byMealType: { 朝食: {...}, 昼食: {...}, ... },
//     records: [...]                         // 個別レコード（最大100件）
//   }

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const GET = withAdminTenant(async (req) => {
  try {
    // 簡易認証：ADMIN_KEY と一致するかチェック
    const queryKey = req.nextUrl.searchParams.get('key');
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      return NextResponse.json(
        { error: 'ADMIN_API_KEY 未設定（Vercel環境変数）' },
        { status: 500 }
      );
    }
    if (queryKey !== adminKey) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const from = req.nextUrl.searchParams.get('from') || daysAgo(30);
    const to = req.nextUrl.searchParams.get('to') || jstToday();

    const records = await getCorrectionRecords(from, to);
    const corrected = records.filter((r) => r.hasCorrection);

    // 平均差分（補正方向）：補正された記録のみで集計
    const sum = corrected.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.diff.kcal,
        P: acc.P + r.diff.P,
        F: acc.F + r.diff.F,
        C: acc.C + r.diff.C,
      }),
      { kcal: 0, P: 0, F: 0, C: 0 }
    );
    const avgDiff =
      corrected.length > 0
        ? {
            kcal: Math.round(sum.kcal / corrected.length),
            P: Math.round((sum.P / corrected.length) * 10) / 10,
            F: Math.round((sum.F / corrected.length) * 10) / 10,
            C: Math.round((sum.C / corrected.length) * 10) / 10,
          }
        : { kcal: 0, P: 0, F: 0, C: 0 };

    // キャリブレーション係数の推奨：AI値に対する補正比率の平均
    const ratioSum = corrected.reduce(
      (acc, r) => ({
        P: acc.P + (r.aiOriginal.P > 0 ? r.current.P / r.aiOriginal.P : 1),
        F: acc.F + (r.aiOriginal.F > 0 ? r.current.F / r.aiOriginal.F : 1),
        C: acc.C + (r.aiOriginal.C > 0 ? r.current.C / r.aiOriginal.C : 1),
      }),
      { P: 0, F: 0, C: 0 }
    );
    const calibrationSuggestion =
      corrected.length > 0
        ? {
            P: Math.round((ratioSum.P / corrected.length) * 100) / 100,
            F: Math.round((ratioSum.F / corrected.length) * 100) / 100,
            C: Math.round((ratioSum.C / corrected.length) * 100) / 100,
          }
        : { P: 1.0, F: 1.0, C: 1.0 };

    // 食事区分別集計
    const byMealType: Record<
      string,
      {
        total: number;
        corrected: number;
        avgDiff: { kcal: number; P: number; F: number; C: number };
      }
    > = {};
    for (const meal of ['朝食', '昼食', '夕食', '間食']) {
      const subset = corrected.filter((r) => r.mealType === meal);
      const totalSubset = records.filter((r) => r.mealType === meal);
      const subSum = subset.reduce(
        (acc, r) => ({
          kcal: acc.kcal + r.diff.kcal,
          P: acc.P + r.diff.P,
          F: acc.F + r.diff.F,
          C: acc.C + r.diff.C,
        }),
        { kcal: 0, P: 0, F: 0, C: 0 }
      );
      byMealType[meal] = {
        total: totalSubset.length,
        corrected: subset.length,
        avgDiff:
          subset.length > 0
            ? {
                kcal: Math.round(subSum.kcal / subset.length),
                P: Math.round((subSum.P / subset.length) * 10) / 10,
                F: Math.round((subSum.F / subset.length) * 10) / 10,
                C: Math.round((subSum.C / subset.length) * 10) / 10,
              }
            : { kcal: 0, P: 0, F: 0, C: 0 },
      };
    }

    // 補正者別の集計（AI学習データ抽出用）
    const byCorrector: Record<'トレーナー' | '顧客' | 'AI', { count: number; records: typeof corrected }> = {
      'トレーナー': { count: 0, records: [] },
      '顧客': { count: 0, records: [] },
      AI: { count: 0, records: [] },
    };
    for (const r of corrected) {
      const key = r.correctedBy && r.correctedBy in byCorrector ? r.correctedBy : 'AI';
      byCorrector[key].count++;
      if (byCorrector[key].records.length < 100) byCorrector[key].records.push(r);
    }

    return NextResponse.json({
      period: { from, to },
      totalRecords: records.length,
      correctedRecords: corrected.length,
      correctionRate:
        records.length > 0 ? Math.round((corrected.length / records.length) * 1000) / 10 : 0,
      avgDiff,
      calibrationSuggestion,
      byMealType,
      byCorrector: {
        トレーナー: byCorrector['トレーナー'].count,
        顧客: byCorrector['顧客'].count,
        未補正: records.length - corrected.length,
      },
      // AI 学習データとして使う: トレーナー補正だけ抽出
      trainerCorrections: byCorrector['トレーナー'].records,
      records: corrected.slice(0, 100),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
