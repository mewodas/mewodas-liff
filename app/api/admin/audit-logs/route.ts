import { NextRequest, NextResponse } from 'next/server';
import { withMasterOnly } from '@/lib/withTenant';
import { listAuditLogs, isDbConnected } from '@/lib/repository/auditLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withMasterOnly(async (req: NextRequest) => {
  if (!isDbConnected()) {
    return NextResponse.json({ error: 'db_not_connected', rows: [] }, { status: 200 });
  }

  const sp = req.nextUrl.searchParams;
  const filter = {
    action: sp.get('action') || undefined,
    outcome: sp.get('outcome') || undefined,
    env: sp.get('env') || 'production',
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    limit: Math.max(1, Math.min(Number(sp.get('limit')) || 100, 500)),
  };

  try {
    const rows = await listAuditLogs(filter);
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
