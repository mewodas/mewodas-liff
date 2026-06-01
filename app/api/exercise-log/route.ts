import { NextRequest, NextResponse } from 'next/server';
import { withLiffTenant } from '@/lib/withTenant';
import { getCustomerByLineId } from '@/lib/notion';
import { getCurrentTenant } from '@/lib/tenant';
import { createExerciseLog, listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['有酸素', '筋トレ', 'ストレッチ', 'その他'] as const;
const VALID_INTENSITIES = ['軽い', '中等度', '激しい'] as const;

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const body = await req.json();
  const { date, exercise, category, durationMin, intensity, estimatedKcal, memo } = body;

  if (!date || !exercise || !category || !intensity) {
    return NextResponse.json({ error: 'date, exercise, category, intensity は必須です' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category は ${VALID_CATEGORIES.join('/')} のいずれか` }, { status: 400 });
  }
  if (!VALID_INTENSITIES.includes(intensity)) {
    return NextResponse.json({ error: `intensity は ${VALID_INTENSITIES.join('/')} のいずれか` }, { status: 400 });
  }

  // 顧客 lookup が null でも運動記録は保存する（customerName は表示用のみ・体重保存と同挙動）。
  const customer = await getCustomerByLineId(verifiedLineUserId).catch(() => null);
  if (!customer) {
    // 原因究明ログ: どのテナント context で顧客が見つからないか（staging の override 絡みの調査用）
    console.error('[exercise-log] customer not found — saving anyway', {
      tenant: getCurrentTenant().id,
      lineUserId: verifiedLineUserId,
    });
  }

  const log = await createExerciseLog({
    lineUserId: verifiedLineUserId,
    customerName: customer?.name ?? '',
    date,
    exercise: String(exercise),
    category: String(category),
    durationMin: Number(durationMin) || 0,
    intensity: String(intensity),
    estimatedKcal: Number(estimatedKcal) || 0,
    memo: String(memo || ''),
  });

  return NextResponse.json({ ok: true, log });
});

export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  const logs = await listExerciseLogsByLineUser(verifiedLineUserId, startDate, endDate);
  return NextResponse.json({ logs });
});
