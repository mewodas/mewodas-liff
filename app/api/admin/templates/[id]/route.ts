import { NextResponse } from 'next/server';
import { updateTemplate, deleteTemplate, isTemplatesConfigured } from '@/lib/templates';
import type { RangeType } from '@/lib/templates';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const PATCH = withAdminTenant(async (req, { params }: { params: Promise<{ id: string }> }) => {
  if (!isTemplatesConfigured()) return NextResponse.json({ error: 'NOTION_TEMPLATES_DB_ID 未設定' }, { status: 503 });
  try {
    const { id } = await params;
    const body = await req.json();
    const RANGE_TYPES = ['昨日', '今日', '先週', '今週', '先月', '今月', 'カスタム'];
    await updateTemplate(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
      titleTemplate: typeof body.titleTemplate === 'string' ? body.titleTemplate : undefined,
      bodyTemplate: typeof body.bodyTemplate === 'string' ? body.bodyTemplate : undefined,
      useAi: typeof body.useAi === 'boolean' ? body.useAi : undefined,
      aiPrompt: typeof body.aiPrompt === 'string' ? body.aiPrompt : undefined,
      rangeType: 'rangeType' in body
        ? (body.rangeType === null ? null : RANGE_TYPES.includes(body.rangeType) ? (body.rangeType as RangeType) : undefined)
        : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const DELETE = withAdminTenant(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
