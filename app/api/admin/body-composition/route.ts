import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import {
  listBodyCompositionLogsByLineUser,
  createBodyCompositionLog,
  updateBodyCompositionLog,
  deleteBodyCompositionLog,
  type CreateBodyCompositionInput,
} from '@/lib/repository/bodyComposition';
import {
  createTenantBodyCompDb,
  listTenantRows,
} from '@/lib/notion';
import { FITMEAL_TENANTS_DB_ID, FITMEAL_TENANTS_PARENT_PAGE_ID, getCurrentTenant } from '@/lib/tenant';
import { invalidateTenantCache } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

async function notionPatch(pageId: string, properties: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.NOTION_MASTER_API_KEY ?? process.env.NOTION_API_KEY ?? '';
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text.slice(0, 300)}`);
  }
}

// 体組成DBが未作成なら自動作成し、レジストリ行へ ID を書き込んで返す（冪等）。
// 同一リクエスト内で repository が参照できるよう、現テナントオブジェクトにも反映する。
async function ensureBodyCompDbId(tenant: ReturnType<typeof getCurrentTenant>): Promise<string> {
  if (tenant.notionBodyCompDbId) return tenant.notionBodyCompDbId;

  const rows = await listTenantRows(FITMEAL_TENANTS_DB_ID);
  const row = rows.find((r) => r.tenantId === tenant.id);
  if (!row) throw new Error('テナント行が見つかりません（体組成DBの自動作成に失敗）');

  const dbId = await createTenantBodyCompDb(tenant.name, FITMEAL_TENANTS_PARENT_PAGE_ID);
  await notionPatch(row.pageId, {
    'Notion 体組成DB ID': { rich_text: [{ type: 'text', text: { content: dbId } }] },
  });
  invalidateTenantCache();
  (tenant as { notionBodyCompDbId?: string }).notionBodyCompDbId = dbId;
  return dbId;
}

export const GET = withAdminTenant(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const lineUserId = url.searchParams.get('lineUserId') || '';
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId 必須' }, { status: 400 });
    }

    const logs = await listBodyCompositionLogsByLineUser(lineUserId, startDate, endDate);
    return NextResponse.json({ logs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withAdminTenant(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    if (action === 'provision-db') {
      const tenant = getCurrentTenant();
      const already = !!tenant.notionBodyCompDbId;
      const dbId = await ensureBodyCompDbId(tenant);
      return NextResponse.json({ ok: true, alreadyExists: already, dbId });
    }

    const input: CreateBodyCompositionInput = {
      lineUserId: String(body.lineUserId || '').trim(),
      customerName: String(body.customerName || '').trim(),
      measureDate: String(body.measureDate || '').trim(),
      weightKg: Number(body.weightKg),
      bodyFatPct: Number(body.bodyFatPct),
      muscleMassKg: Number(body.muscleMassKg),
      bodyFatMassKg: body.bodyFatMassKg !== undefined && body.bodyFatMassKg !== '' ? Number(body.bodyFatMassKg) : null,
      bodyWaterPct: body.bodyWaterPct !== undefined && body.bodyWaterPct !== '' ? Number(body.bodyWaterPct) : null,
      bmi: body.bmi !== undefined && body.bmi !== '' ? Number(body.bmi) : null,
      basalMetabolicKcal: body.basalMetabolicKcal !== undefined && body.basalMetabolicKcal !== '' ? Number(body.basalMetabolicKcal) : null,
      visceralFatLevel: body.visceralFatLevel !== undefined && body.visceralFatLevel !== '' ? Number(body.visceralFatLevel) : null,
      skeletalMuscleMassKg: body.skeletalMuscleMassKg !== undefined && body.skeletalMuscleMassKg !== '' ? Number(body.skeletalMuscleMassKg) : null,
      rightArmMuscleKg: body.rightArmMuscleKg !== undefined && body.rightArmMuscleKg !== '' ? Number(body.rightArmMuscleKg) : null,
      leftArmMuscleKg: body.leftArmMuscleKg !== undefined && body.leftArmMuscleKg !== '' ? Number(body.leftArmMuscleKg) : null,
      rightLegMuscleKg: body.rightLegMuscleKg !== undefined && body.rightLegMuscleKg !== '' ? Number(body.rightLegMuscleKg) : null,
      leftLegMuscleKg: body.leftLegMuscleKg !== undefined && body.leftLegMuscleKg !== '' ? Number(body.leftLegMuscleKg) : null,
      trunkMuscleKg: body.trunkMuscleKg !== undefined && body.trunkMuscleKg !== '' ? Number(body.trunkMuscleKg) : null,
      device: body.device || null,
      memo: String(body.memo || ''),
      registeredBy: String(body.registeredBy || ''),
    };

    if (!input.lineUserId) return NextResponse.json({ error: 'lineUserId 必須' }, { status: 400 });
    if (!input.measureDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.measureDate)) {
      return NextResponse.json({ error: '計測日の形式が不正（YYYY-MM-DD）' }, { status: 400 });
    }
    if (isNaN(input.weightKg) || input.weightKg <= 0) {
      return NextResponse.json({ error: '体重(kg) は正の数で入力してください' }, { status: 400 });
    }

    // 編集（id 指定）は対象レコードを直接上書き。計測日を変えても複製されず元データが更新される。
    if (body.id) {
      const log = await updateBodyCompositionLog(String(body.id), input);
      return NextResponse.json({ ok: true, log });
    }

    // 新規（同一顧客×同一計測日があれば upsert）。体組成DB未作成なら自動作成してから保存。
    await ensureBodyCompDbId(getCurrentTenant());

    const log = await createBodyCompositionLog(input);
    return NextResponse.json({ ok: true, log });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const DELETE = withAdminTenant(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id 必須' }, { status: 400 });

    await deleteBodyCompositionLog(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
