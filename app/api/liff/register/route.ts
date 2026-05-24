import { NextRequest, NextResponse } from 'next/server';
import { withLiffTenantAccessToken, runWithTenantById } from '@/lib/withTenant';
import { getCustomerByLineId } from '@/lib/notion';
import { createCustomer, patchCustomer } from '@/lib/repository/customers';
import { getCurrentTenant } from '@/lib/tenant';
import { getTenantByIdAsync } from '@/lib/tenantResolver';
import { fetchOfficialLineUrl } from '@/lib/lineBot';
import { calcGoals } from '@/lib/goalCalc';
import { getSeatStatus } from '@/lib/seats';
import { verifyInviteToken } from '@/lib/inviteToken';

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

// 招待トークン優先のテナント解決ラッパー:
// x-invite-token があれば HMAC 検証して verified tenant で fn を実行する。
// なければ withLiffTenantAccessToken で解決された現テナント（x-tenant-id / x-liff-id / default）を使う。
//
// 重要な構造上の制約:
//   - 本関数の OUTSIDE (= fn コールバックの外) で getCurrentTenant() を絶対に呼ばないこと。
//     withLiffTenantAccessToken が x-tenant-id 由来の未検証テナント context を設定済みで、
//     招待トークンの verified テナントへの上書きは fn を runInTenantContext で包む中で発生するため。
//   - 必ず fn コールバック内に DB 参照・席数チェック・テナント設定の取得などを置く。
async function withInviteOrCurrentTenant<T>(
  req: NextRequest,
  fn: () => Promise<T>
): Promise<T | NextResponse> {
  const inviteToken = req.headers.get('x-invite-token');
  if (!inviteToken) return fn();
  const payload = verifyInviteToken(inviteToken);
  if (!payload) {
    return NextResponse.json(
      { error: '招待リンクが無効、または期限切れです。担当トレーナーから新しいリンクを取得してください。' },
      { status: 401 }
    );
  }
  // tenantId の存在を Notion で明示確認してから runWithTenantById を呼ぶ。
  // 直接 runWithTenantById に渡すと、Notion から見つからなかった場合に getDefaultTenant() (= メヲダス) に
  // 暗黙的にフォールバックしてしまい、攻撃者が存在しない tenantId のトークンでメヲダスに顧客登録できる脆弱性になる。
  let tenant;
  try {
    tenant = await getTenantByIdAsync(payload.tenantId);
  } catch {
    tenant = null;
  }
  if (!tenant) {
    return NextResponse.json(
      { error: '招待リンクに対応するジムが見つかりません。担当トレーナーにお問い合わせください。' },
      { status: 404 }
    );
  }
  return runWithTenantById(payload.tenantId, fn);
}

export const GET = withLiffTenantAccessToken(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  return withInviteOrCurrentTenant(req, async () => {
    const [existing, seatStatus] = await Promise.all([
      getCustomerByLineId(verifiedLineUserId, { force: true }),
      getSeatStatus(),
    ]);
    return NextResponse.json({
      alreadyRegistered: !!existing,
      overLimit: seatStatus.isOverLimit,
    });
  });
});

export const POST = withLiffTenantAccessToken(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  return withInviteOrCurrentTenant(req, async () => {
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
        tenantId: tenant.id,
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
    const heightCmRaw = body.heightCm != null ? parseFloat(String(body.heightCm)) : NaN;
    const currentWeightRaw = body.currentWeight != null ? parseFloat(String(body.currentWeight)) : NaN;
    const targetWeightRaw = body.targetWeight != null ? parseFloat(String(body.targetWeight)) : NaN;
    const heightCm = isNaN(heightCmRaw) ? undefined : heightCmRaw;
    const currentWeight = isNaN(currentWeightRaw) ? undefined : currentWeightRaw;
    const targetWeight = isNaN(targetWeightRaw) ? undefined : targetWeightRaw;

    // 名前のみ必須。身長・体重・他はトレーナーが後から /admin で入力できる
    if (!name) {
      return NextResponse.json(
        { error: 'お名前は必須です' },
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

    // 身長・体重が両方そろっている場合のみ目標 PFC を自動計算する
    // どちらか欠ければ goals 未設定で登録（後でトレーナーが /admin から再計算可能）
    let calc: ReturnType<typeof calcGoals> = null;
    if (heightCm != null && currentWeight != null) {
      const effectiveTargetWeight = targetWeight ?? currentWeight;
      calc = calcGoals({
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
    }

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
      tenantId: tenant.id,
    });
  });
});
