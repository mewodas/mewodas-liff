import { NextRequest, NextResponse } from 'next/server';
import { getWeightOnDate } from '@/lib/repository/weightLogs';
import { getExerciseOnDate } from '@/lib/repository/exerciseLogs';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 体重・運動とも新DB（体重ログDB / 運動ログDB）から取得（個人シート走査不要）。
export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    const date = req.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date が必要' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }

    const [weightLog, exerciseState] = await Promise.all([
      getWeightOnDate(verifiedLineUserId, date).catch(() => null),
      getExerciseOnDate(verifiedLineUserId, date).catch(() => ({ exercised: false, content: '' })),
    ]);
    const weightStr = weightLog ? String(weightLog.weightKg) : '';
    const exercised = exerciseState.exercised ? '✅' : '';
    const exerciseContent = exerciseState.content;

    const res = NextResponse.json({ weight: weightStr, exercised, exerciseContent });
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
