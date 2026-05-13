import { NextRequest, NextResponse } from 'next/server';
import {
  getAllActiveCustomers,
  getFoodRecordsByDate,
  getDailyExtras,
  isoToJpMd,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CustomerOverview = {
  lineUserId: string;
  name: string;
  goals: { kcal: number; P: number; F: number; C: number };
  totals: { kcal: number; P: number; F: number; C: number };
  pct: number;
  mealsRecorded: { 朝食: boolean; 昼食: boolean; 夕食: boolean; 間食: boolean };
  weight: string;
  exercised: boolean;
  exerciseContent: string;
  lastRecordedAt: string | null;
  warnings: string[];
};

function jstNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function jstTodayString(): string {
  const d = jstNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }

    const trainerId = process.env.TRAINER_LINE_USER_ID;
    if (!trainerId) {
      return NextResponse.json(
        { error: 'TRAINER_LINE_USER_ID 未設定（Vercel環境変数）' },
        { status: 500 }
      );
    }
    if (lineUserId !== trainerId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const date = req.nextUrl.searchParams.get('date') || jstTodayString();
    const dateLabel = isoToJpMd(date);
    const currentHour = jstNow().getHours();

    const customers = await getAllActiveCustomers();

    // 顧客ごとの当日サマリを並列取得
    const overviews: CustomerOverview[] = await Promise.all(
      customers.map(async (c) => {
        const [records, extras] = await Promise.all([
          getFoodRecordsByDate(c.lineUserId, date),
          c.foodSheetPageId
            ? getDailyExtras(c.foodSheetPageId, dateLabel)
            : Promise.resolve({ weight: '', exercised: '', exerciseContent: '' }),
        ]);

        const totals = records.reduce(
          (acc, r) => ({
            kcal: acc.kcal + r.kcal,
            P: acc.P + r.P,
            F: acc.F + r.F,
            C: acc.C + r.C,
          }),
          { kcal: 0, P: 0, F: 0, C: 0 }
        );

        const mealsRecorded = {
          朝食: records.some((r) => r.mealType === '朝食'),
          昼食: records.some((r) => r.mealType === '昼食'),
          夕食: records.some((r) => r.mealType === '夕食'),
          間食: records.some((r) => r.mealType === '間食'),
        };

        const pct =
          c.goals.kcal > 0 ? Math.round((totals.kcal / c.goals.kcal) * 100) : 0;

        const warnings: string[] = [];
        if (currentHour >= 10 && !mealsRecorded.朝食) warnings.push('朝食未記録');
        if (currentHour >= 15 && !mealsRecorded.昼食) warnings.push('昼食未記録');
        if (currentHour >= 22 && !mealsRecorded.夕食) warnings.push('夕食未記録');
        if (records.length > 0 && Math.abs(pct - 100) > 20) {
          warnings.push(pct > 120 ? 'カロリー超過' : 'カロリー不足');
        }
        if (!extras.weight && currentHour >= 12) warnings.push('体重未記録');

        const lastRecord = records[records.length - 1];

        return {
          lineUserId: c.lineUserId,
          name: c.name,
          goals: c.goals,
          totals: {
            kcal: Math.round(totals.kcal),
            P: Math.round(totals.P * 10) / 10,
            F: Math.round(totals.F * 10) / 10,
            C: Math.round(totals.C * 10) / 10,
          },
          pct,
          mealsRecorded,
          weight: extras.weight,
          exercised: extras.exercised === '✅',
          exerciseContent: extras.exerciseContent,
          lastRecordedAt: lastRecord
            ? new Date(lastRecord.recordedAt).toLocaleTimeString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
          warnings,
        };
      })
    );

    // 警告がある顧客を上に並べる
    overviews.sort((a, b) => {
      if (a.warnings.length !== b.warnings.length) {
        return b.warnings.length - a.warnings.length;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      date,
      dateLabel,
      currentHour,
      customers: overviews,
      summary: {
        total: overviews.length,
        warning: overviews.filter((c) => c.warnings.length > 0).length,
        ok: overviews.filter((c) => c.warnings.length === 0).length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
