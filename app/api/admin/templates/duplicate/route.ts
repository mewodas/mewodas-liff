import { NextResponse } from 'next/server';
import { getTemplate, createTemplate, isTemplatesConfigured } from '@/lib/templates';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withAdminTenant(async (req) => {
  if (!isTemplatesConfigured()) {
    return NextResponse.json({ error: 'NOTION_TEMPLATES_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const sourceId = String(body.sourceId || '').trim();
    if (!sourceId) return NextResponse.json({ error: 'sourceId 必須' }, { status: 400 });
    if (sourceId.startsWith('default-')) {
      return NextResponse.json({ error: 'デフォルトテンプレートは複製できません' }, { status: 400 });
    }
    const source = await getTemplate(sourceId);
    if (!source) return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
    const newTemplate = await createTemplate({
      name: `${source.name} (コピー)`,
      category: source.category,
      titleTemplate: source.titleTemplate,
      bodyTemplate: source.bodyTemplate,
      useAi: source.useAi,
      aiPrompt: source.aiPrompt,
      rangeType: source.rangeType,
      sortOrder: source.sortOrder !== undefined ? source.sortOrder + 5 : undefined,
    });
    return NextResponse.json({ ok: true, template: newTemplate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
