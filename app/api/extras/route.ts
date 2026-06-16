import { NextRequest, NextResponse } from 'next/server';
import { getWeightOnDate } from '@/lib/repository/weightLogs';
import { getExerciseOnDate } from '@/lib/repository/exerciseLogs';
import { getDailyNoteOnDate, isDailyNoteEnabled } from '@/lib/repository/dailyNotes';
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

    // 備考も体重・運動と同じバッチで取得し、ホームで3つ同時に表示できるようにする
    // （カード側の別 fetch を廃止＝表示ラグ解消＋往復1回削減）。DB 未割当テナントは取得しない。
    const dailyNoteEnabled = isDailyNoteEnabled();
    const [weightLog, exerciseState, dailyNoteLog] = await Promise.all([
      getWeightOnDate(verifiedLineUserId, date).catch(() => null),
      getExerciseOnDate(verifiedLineUserId, date).catch(() => ({ exercised: false, content: '' })),
      dailyNoteEnabled
        ? getDailyNoteOnDate(verifiedLineUserId, date).catch(() => null)
        : Promise.resolve(null),
    ]);
    const weightStr = weightLog ? String(weightLog.weightKg) : '';
    const exercised = exerciseState.exercised ? '✅' : '';
    const exerciseContent = exerciseState.content;

    const res = NextResponse.json({
      weight: weightStr,
      exercised,
      exerciseContent,
      dailyNote: dailyNoteLog?.note ?? '',
      dailyNoteEnabled,
    });
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
