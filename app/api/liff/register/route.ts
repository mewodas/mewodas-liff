import { NextRequest, NextResponse } from 'next/server';
import { withLiffTenantAccessToken } from '@/lib/withTenant';
import { getCustomerByLineId } from '@/lib/notion';
import { createCustomer, patchCustomer } from '@/lib/repository/customers';
import { getCurrentTenant } from '@/lib/tenant';
import { fetchOfficialLineUrl } from '@/lib/lineBot';
import { calcGoals } from '@/lib/goalCalc';
import { getSeatStatus } from '@/lib/seats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function nowJst(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T') + '+09:00';
}

function ageFromBirthdate(birthdate: string): number | undefined {
  try {
    const [y, m, d] = birthdate.split('-').map(Number);
    const today = new Date();
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
    return age > 0 ? age : undefined;
  } catch {
    return undefined;
  }
}

export const GET = withLiffTenantAccessToken(async (_req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  const [existing, seatStatus] = await Promise.all([
    getCustomerByLineId(verifiedLineUserId, { force: true }),
    getSeatStatus(),
  ]);
  return NextResponse.json({
    alreadyRegistered: !!existing,
    overLimit: seatStatus.isOverLimit,
  });
});

export const POST = withLiffTenantAccessToken(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  // 重複チェック: 同じ LINE ID の顧客が既にいれば二重作成しない
  const existing = await getCustomerByLineId(verifiedLineUserId, { force: true });
  if (existing) {
    const tenant = getCurrentTenant();
    let officialLineUrl = tenant.officialLineUrl || '';
    if (!officialLineUrl && tenant.lineChannelToken) {
      officialLineUrl = (await fetchOfficialLineUrl(tenant.lineChannelToken)) || '';
    }
    if (!officialLineUrl) officialLineUrl = process.env.OFFICIAL_LINE_URL || '';
    return NextResponse.json({
      ok: true,
      alreadyRegistered: true,
      customerId: existing.pageId,
      customerName: existing.name,
      officialLineUrl,
    });
  }

  // 席数上限チェック（登録済み顧客はブロックしない）
  const seatStatus = await getSeatStatus();
  if (seatStatus.isOverLimit) {
    return NextResponse.json(
      { error: '定員に達しているため登録できません。担当トレーナーにお問い合わせください。' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = String(body.name || '').trim();
  const heightCm = body.heightCm ? parseFloat(String(body.heightCm)) : NaN;
  const currentWeight = body.currentWeight ? parseFloat(String(body.currentWeight)) : NaN;
  const targetWeightRaw = body.targetWeight != null ? parseFloat(String(body.targetWeight)) : NaN;
  const targetWeight = isNaN(targetWeightRaw) ? undefined : targetWeightRaw;

  if (!name || isNaN(heightCm) || isNaN(currentWeight)) {
    return NextResponse.json(
      { error: '名前・身長・現在体重は必須です' },
      { status: 400 }
    );
  }

  const gender = String(body.gender || '').trim() || undefined;
  const birthdate = String(body.birthdate || '').trim() || undefined;
  const age = birthdate ? ageFromBirthdate(birthdate) : undefined;
  const activityLevel = String(body.activityLevel || '').trim() || undefined;
  const targetDate = String(body.targetDate || '').trim() || undefined;
  const today = jstToday();

  let activityLevelNormalized: string | undefined;
  if (activityLevel) {
    if (activityLevel.includes('低') || activityLevel.includes('ほぼ')) activityLevelNormalized = 'ほぼ運動なし';
    else if (activityLevel.includes('中')) activityLevelNormalized = '中等度';
    else if (activityLevel.includes('高') || activityLevel.includes('激')) activityLevelNormalized = '激しい';
    else activityLevelNormalized = activityLevel;
  }

  // targetWeight 未指定時は currentWeight を目標として計算（現状維持）
  const effectiveTargetWeight = targetWeight ?? currentWeight;
  const calc = calcGoals({
    gender: gender || null,
    heightCm,
    age: age ?? null,
    activityLevel: activityLevelNormalized || null,
    plan: effectiveTargetWeight < currentWeight ? '減量' : effectiveTargetWeight > currentWeight ? '増量' : '現状維持',
    currentWeight,
    targetWeight: effectiveTargetWeight,
    targetDate: targetDate || null,
    today,
  });

  const customer = await createCustomer({
    name,
    lineUserId: verifiedLineUserId,
    foodStatus: '進行中',
    gender,
    heightCm,
    age,
    birthdate,
    activityLevel: activityLevelNormalized,
    currentWeight,
    targetWeight,
    targetDate,
    goals: calc
      ? { kcal: calc.goalKcal, P: calc.goalP, F: calc.goalF, C: calc.goalC }
      : undefined,
    registrationCompletedAt: nowJst(),
  });

  if (customer.onboardingCompletedAt) {
    await patchCustomer(customer.pageId, { onboardingCompletedAt: null });
  }

  const tenant = getCurrentTenant();
  let officialLineUrl = tenant.officialLineUrl || '';
  if (!officialLineUrl && tenant.lineChannelToken) {
    officialLineUrl = (await fetchOfficialLineUrl(tenant.lineChannelToken)) || '';
  }
  if (!officialLineUrl) officialLineUrl = process.env.OFFICIAL_LINE_URL || '';

  return NextResponse.json({
    ok: true,
    alreadyRegistered: false,
    customerId: customer.pageId,
    customerName: customer.name,
    officialLineUrl,
  });
});
