// PFC キャリブレーション診断エンドポイント（staging 専用）
//
// staging.fitmeal.jp/api/admin/debug-calibration にアクセスすると、
// 現在解決されるテナントとそのキャリブレーション係数を返す。
// キャッシュをクリアしてから最新の Notion 値を取得するため、Notion で
// 値を変えた直後でも即座に反映が確認できる。
//
// 本番では FITMEAL_TENANT_ID_OVERRIDE が未設定なので 404 を返す（誤公開防止）。

import { NextRequest, NextResponse } from 'next/server';
import { getTenantByIdAsync, getApplicableCalibration, invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const overrideId = process.env.FITMEAL_TENANT_ID_OVERRIDE;
  if (!overrideId) {
    return NextResponse.json({ error: 'disabled (no FITMEAL_TENANT_ID_OVERRIDE)' }, { status: 404 });
  }

  // キャッシュをクリアして最新の Notion 値を取得
  invalidateTenantCache();

  const tenant = await getTenantByIdAsync(overrideId);

  if (!tenant) {
    return NextResponse.json({
      error: 'tenant not found',
      tenantIdSearched: overrideId,
    }, { status: 404 });
  }

  const calibration = getApplicableCalibration(tenant);

  return NextResponse.json({
    env: {
      FITMEAL_TENANT_ID_OVERRIDE: overrideId,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
    },
    pfcOverride: {
      P: tenant.pfcOverrideP,
      F: tenant.pfcOverrideF,
      C: tenant.pfcOverrideC,
    },
    pfcRecommended: {
      P: tenant.pfcRecommendedP,
      F: tenant.pfcRecommendedF,
      C: tenant.pfcRecommendedC,
    },
    appliedCalibration: calibration,
    cacheCleared: true,
  });
}
