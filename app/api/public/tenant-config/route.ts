import { NextRequest, NextResponse } from 'next/server';
import { getTenantByIdAsync } from '@/lib/tenantResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400, headers: corsHeaders });
  }

  try {
    const tenant = await getTenantByIdAsync(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        liffId: tenant.liffId ?? null,
        gymName: tenant.name,
        brandColor: tenant.themeColor ?? '#059669',
        logoUrl: null,
        officialLineUrl: tenant.officialLineUrl ?? null,
      },
      {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
