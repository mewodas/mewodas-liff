import { NextRequest, NextResponse } from 'next/server';
import { withLiffTenant } from '@/lib/withTenant';
import { getCustomerByLineId } from '@/lib/notion';
import { createExerciseLog, listExerciseLogsByLineUser } from '@/lib/repository/exerciseLogs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['有酸素', '筋トレ', 'ストレッチ', 'その他'] as const;
const VALID_INTENSITIES = ['軽い', '中等度', '激しい'] as const;

export const POST = withLiffTenant(async (req: NextRequest) => {
  const body = await req.json();
  const { lineUserId, date, exercise, category, durationMin, intensity, estimatedKcal, memo } = body;

  if (!lineUserId || !date || !exercise || !category || !intensity) {
    return NextResponse.json({ error: 'lineUserId, date, exercise, category, intensity は必須です' }, { status: 400 });
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

  const customer = await getCustomerByLineId(lineUserId);
  if (!customer) {
    return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
  }

  const log = await createExerciseLog({
    lineUserId,
    customerName: customer.name,
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

export const GET = withLiffTenant(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get('lineUserId') || '';
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId は必須です' }, { status: 400 });
  }

  const logs = await listExerciseLogsByLineUser(lineUserId, startDate, endDate);
  return NextResponse.json({ logs });
});
