import { NextRequest, NextResponse } from 'next/server';
import { searchFoods } from '@/lib/foodDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const category = req.nextUrl.searchParams.get('category') || '';
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30', 10);

  let items = searchFoods(q, 200);
  if (category) {
    items = items.filter((f) => f.category === category);
  }
  return NextResponse.json({ items: items.slice(0, limit) });
}
