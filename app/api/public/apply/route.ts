import { NextRequest, NextResponse } from 'next/server';
import { findTenantBySlugOrId, getTenantByIdAsync } from '@/lib/tenantResolver';
import { getDefaultTenant } from '@/lib/tenant';
import { runInTenantContext } from '@/lib/tenantContext';
import { createCustomer } from '@/lib/repository/customers';
import { calcGoals } from '@/lib/goalCalc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

// CORS headers for public endpoint
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Simple in-memory rate limit: 1 IP につき 1 分間に 3 件まで。
// Vercel function instance ごとに別 Map なので完璧ではないが、基本的な DoS / spam 対策。
type RateRecord = { count: number; windowStart: number };
const rateMap = new Map<string, RateRecord>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (rec.count >= RATE_MAX) {
    return { ok: false, retryAfter: Math.ceil((rec.windowStart + RATE_WINDOW_MS - now) / 1000) };
  }
  rec.count++;
  return { ok: true };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // レートリミット (IP ベース)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。少し待ってから再度お試しください' },
      {
        status: 429,
        headers: { ...CORS_HEADERS, 'Retry-After': String(limit.retryAfter || 60) },
      }
    );
  }

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const heightCm = body.heightCm ? parseFloat(String(body.heightCm)) : NaN;
    const currentWeight = body.currentWeight ? parseFloat(String(body.currentWeight)) : NaN;
    const targetWeight = body.targetWeight ? parseFloat(String(body.targetWeight)) : NaN;

    if (!name || !email || isNaN(heightCm) || isNaN(currentWeight) || isNaN(targetWeight)) {
      return NextResponse.json(
        { error: '名前・メール・身長・現在体重・目標体重は必須です' },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400, headers: CORS_HEADERS });
    }

    // テナント解決
    let tenant = getDefaultTenant();
    const slugOrId = String(body.tenantSlug || body.tenantId || '').trim();
    if (slugOrId) {
      const found = await findTenantBySlugOrId(slugOrId);
      if (found) tenant = found;
      else {
        const byId = await getTenantByIdAsync(slugOrId);
        if (byId) tenant = byId;
      }
    }

    const gender = String(body.gender || '').trim() || undefined;
    const birthdate = String(body.birthdate || '').trim() || undefined;
    const age = birthdate ? ageFromBirthdate(birthdate) : undefined;
    const activityLevel = String(body.activityLevel || '').trim() || undefined;
    const today = jstToday();

    // アクティビティラベルを既存形式に変換
    let activityLevelNormalized: string | undefined;
    if (activityLevel) {
      if (activityLevel.includes('低') || activityLevel.includes('ほぼ')) activityLevelNormalized = 'ほぼ運動なし';
      else if (activityLevel.includes('中')) activityLevelNormalized = '中等度';
      else if (activityLevel.includes('高') || activityLevel.includes('激')) activityLevelNormalized = '激しい';
      else activityLevelNormalized = activityLevel;
    }

    // BMR/TDEE から目標値を自動計算
    const calc = calcGoals({
      gender: gender || null,
      heightCm,
      age: age ?? null,
      activityLevel: activityLevelNormalized || null,
      plan: targetWeight < currentWeight ? '減量' : targetWeight > currentWeight ? '増量' : '現状維持',
      currentWeight,
      targetWeight,
      targetDate: null,
      today,
    });

    return await runInTenantContext(tenant, async () => {
      const customer = await createCustomer({
        name,
        foodStatus: '進行中',
        gender: gender || undefined,
        heightCm,
        age,
        activityLevel: activityLevelNormalized,
        currentWeight,
        targetWeight,
        goals: calc
          ? { kcal: calc.goalKcal, P: calc.goalP, F: calc.goalF, C: calc.goalC }
          : undefined,
      });

      return NextResponse.json({ ok: true, customerId: customer.pageId }, { headers: CORS_HEADERS });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
