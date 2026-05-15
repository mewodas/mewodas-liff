import { NextResponse } from 'next/server';
import { listTemplates, createTemplate, isTemplatesConfigured, DEFAULT_TEMPLATES } from '@/lib/templates';
import type { RangeType } from '@/lib/templates';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async () => {
  if (!isTemplatesConfigured()) {
    return NextResponse.json({ configured: false, templates: DEFAULT_TEMPLATES });
  }
  try {
    const templates = await listTemplates();
    return NextResponse.json({ configured: true, templates });
  } catch (e) {
    // Notion 接続失敗時（Integration 未招待等）はデフォルトテンプレを返す
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({
      configured: true,
      templates: DEFAULT_TEMPLATES,
      error: `Notion接続失敗: ${message.slice(0, 200)}`,
      hint: 'FitMeal テンプレートDB に Notion Integration を招待してください',
    });
  }
});

export const POST = withAdminTenant(async (req) => {
  if (!isTemplatesConfigured()) {
    return NextResponse.json({ error: 'NOTION_TEMPLATES_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: '名前必須' }, { status: 400 });
    const RANGE_TYPES = ['昨日', '今日', '先週', '今週', '先月', '今月', 'カスタム'];
    const template = await createTemplate({
      name,
      category: String(body.category || 'カスタム'),
      titleTemplate: String(body.titleTemplate || ''),
      bodyTemplate: String(body.bodyTemplate || ''),
      useAi: !!body.useAi,
      aiPrompt: String(body.aiPrompt || ''),
      rangeType: RANGE_TYPES.includes(body.rangeType) ? (body.rangeType as RangeType) : undefined,
    });
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
