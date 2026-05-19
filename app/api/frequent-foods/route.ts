import { NextRequest, NextResponse } from 'next/server';
import { getCustomerByLineId, getFoodRecordsByDateRange } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type FrequentFood = {
  title: string;
  count: number;
  kcal: number;
  P: number;
  F: number;
  C: number;
  lastMealType: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function jstDateString(d: Date): string {
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${jst.getFullYear()}-${pad2(jst.getMonth() + 1)}-${pad2(jst.getDate())}`;
}

// タイトル正規化：余分な空白除去・「（…）」括弧除去・末尾の付帯情報をトリム
function normalizeTitle(raw: string): string {
  return raw
    .replace(/[（(].*?[)）]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[、,].*$/, '')
    .trim();
}

export async function GET(req: NextRequest) {
  try {
    const lineUserId = req.nextUrl.searchParams.get('lineUserId');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '8', 10);
    const days = parseInt(req.nextUrl.searchParams.get('days') || '90', 10);

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId が必要です' }, { status: 400 });
    }

    const customer = await getCustomerByLineId(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const start = jstDateString(startDate);
    const end = jstDateString(now);

    const records = await getFoodRecordsByDateRange(lineUserId, start, end);

    type Bucket = {
      title: string;
      count: number;
      kcalSum: number;
      pSum: number;
      fSum: number;
      cSum: number;
      lastMealType: string;
      lastDate: string;
    };
    const map = new Map<string, Bucket>();

    for (const r of records) {
      const t = normalizeTitle(r.title || '');
      if (!t || t.length < 2) continue;
      if (r.kcal <= 0) continue;
      const key = t;
      const b = map.get(key) || {
        title: t,
        count: 0,
        kcalSum: 0,
        pSum: 0,
        fSum: 0,
        cSum: 0,
        lastMealType: r.mealType,
        lastDate: r.date,
      };
      b.count += 1;
      b.kcalSum += r.kcal;
      b.pSum += r.P;
      b.fSum += r.F;
      b.cSum += r.C;
      if (r.date >= b.lastDate) {
        b.lastDate = r.date;
        b.lastMealType = r.mealType;
      }
      map.set(key, b);
    }

    const items: FrequentFood[] = Array.from(map.values())
      .filter((b) => b.count >= 2) // 2回以上記録されたものだけ
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastDate.localeCompare(a.lastDate);
      })
      .slice(0, limit)
      .map((b) => ({
        title: b.title,
        count: b.count,
        kcal: Math.round(b.kcalSum / b.count),
        P: Math.round((b.pSum / b.count) * 10) / 10,
        F: Math.round((b.fSum / b.count) * 10) / 10,
        C: Math.round((b.cSum / b.count) * 10) / 10,
        lastMealType: b.lastMealType,
      }));

    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
