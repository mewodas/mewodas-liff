import { NextRequest, NextResponse } from 'next/server';
import { listStaff, createStaff, isStaffConfigured } from '@/lib/staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  if (!isStaffConfigured()) return NextResponse.json({ configured: false, staff: [] });
  const staff = await listStaff();
  return NextResponse.json({ configured: true, staff });
}

export async function POST(req: NextRequest) {
  if (!isStaffConfigured()) {
    return NextResponse.json({ error: 'NOTION_STAFF_DB_ID 未設定' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: '名前必須' }, { status: 400 });
    const staff = await createStaff({
      name,
      shop: String(body.shop || '').trim(),
      role: String(body.role || '').trim(),
    });
    return NextResponse.json({ ok: true, staff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
