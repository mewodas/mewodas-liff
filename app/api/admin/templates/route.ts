import { NextResponse } from 'next/server';
import { listTemplates, createTemplate, isTemplatesConfigured, DEFAULT_TEMPLATES } from '@/lib/templates';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = withAdminTenant(async () => {
  if (!isTemplatesConfigured()) {
    return NextResponse.json({ configured: false, templates: DEFAULT_TEMPLATES });
  }
  const templates = await listTemplates();
  return NextResponse.json({ configured: true, templates });
});

export const POST = withAdminTenant(async (req) => {
  if (!isTemplatesConfigured()) {
    return NextResponse.json({ error: 'NOTION_TEMPLATES_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: '名前必須' }, { status: 400 });
    const template = await createTemplate({
      name,
      category: String(body.category || 'カスタム'),
      titleTemplate: String(body.titleTemplate || ''),
      bodyTemplate: String(body.bodyTemplate || ''),
      useAi: !!body.useAi,
      aiPrompt: String(body.aiPrompt || ''),
    });
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
