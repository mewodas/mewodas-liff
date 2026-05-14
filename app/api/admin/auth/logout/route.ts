import { NextResponse } from 'next/server';
import { clearSessionCookieOptions } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const c = clearSessionCookieOptions();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
