import { NextResponse } from 'next/server';
import { listAllRecordsInRange } from '@/lib/repository/records';
import { listCustomers } from '@/lib/repository/customers';
import { withAdminTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 食事区分の並び順
const MEAL_ORDER = ['朝食', '昼食', '夕食', '間食'];

export const GET = withAdminTenant(async (req) => {
  try {
    const sp = req.nextUrl.searchParams;
    const date = sp.get('date'); // 単一日（指定優先）
    const from = sp.get('from'); // 範囲開始
    const to = sp.get('to'); // 範囲終了
    const customerId = sp.get('customerId'); // pageId
    const weekday = sp.get('weekday'); // 0-6（日〜土）。'all' は無効値
    const mealType = sp.get('mealType'); // 朝食/昼食/夕食/間食。空は全部

    let startDate: string;
    let endDate: string;
    if (date) {
      startDate = date;
      endDate = date;
    } else if (from && to) {
      startDate = from;
      endDate = to;
    } else {
      // 既定：今日
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      startDate = today;
      endDate = today;
    }

    const [allRecords, customers] = await Promise.all([
      listAllRecordsInRange(startDate, endDate),
      listCustomers(),
    ]);

    // customer index: lineUserId → { name, pageId, foodStatus }
    const idx = new Map<string, { pageId: string; name: string; foodStatus: string | null }>();
    for (const c of customers) {
      if (c.lineUserId) idx.set(c.lineUserId, { pageId: c.pageId, name: c.name, foodStatus: c.foodStatus });
    }

    const filtered = allRecords.filter((r) => {
      // 顧客フィルタ
      if (customerId) {
        const c = r.lineUserId ? idx.get(r.lineUserId) : undefined;
        if (!c || c.pageId !== customerId) return false;
      }
      // 食事区分フィルタ
      if (mealType && r.mealType !== mealType) return false;
      // 曜日フィルタ（互換のため残すが、UIからは消す）
      if (weekday !== null && weekday !== '' && weekday !== 'all') {
        const w = Number(weekday);
        if (Number.isFinite(w) && w >= 0 && w <= 6) {
          const [y, m, d] = r.date.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          if (dt.getDay() !== w) return false;
        }
      }
      return true;
    });

    // 同写真食事をグルーピング:
    // 同じ (lineUserId, date, mealType) で recordedAt が ±60秒以内なら同じ "写真" 由来とみなす
    // → imageUrl を持つ records から兄弟へ伝播 + groupId を付与
    type Enriched = {
      pageId: string;
      date: string;
      recordedAt: string;
      mealType: string;
      title: string;
      memo: string;
      kcal: number;
      P: number;
      F: number;
      C: number;
      imageUrl: string | null;
      details: typeof filtered[number]['details'];
      lineUserId: string;
      customerId: string | null;
      customerName: string;
      customerStatus: string | null;
      groupId: string;
    };
    const sorted = [...filtered].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const groupAssign = new Map<string, { groupId: string; imageUrl: string | null }>(); // pageId → group情報
    let groupCounter = 0;
    type GroupBucket = { groupId: string; lastTime: number; imageUrl: string | null };
    const buckets = new Map<string, GroupBucket>(); // key: lineUserId|date|mealType
    for (const r of sorted) {
      const key = `${r.lineUserId || ''}|${r.date}|${r.mealType}`;
      const t = Date.parse(r.recordedAt) || 0;
      const existing = buckets.get(key);
      let bucket = existing;
      if (!existing || Math.abs(t - existing.lastTime) > 60_000) {
        groupCounter++;
        bucket = { groupId: `g${groupCounter}`, lastTime: t, imageUrl: r.imageUrl || null };
        buckets.set(key, bucket);
      } else {
        bucket = existing;
        bucket.lastTime = t;
        if (!bucket.imageUrl && r.imageUrl) bucket.imageUrl = r.imageUrl;
      }
      groupAssign.set(r.pageId, { groupId: bucket.groupId, imageUrl: bucket.imageUrl });
    }
    // 2nd pass: バケット最終確定 imageUrl を全 members へ伝播
    for (const r of sorted) {
      const key = `${r.lineUserId || ''}|${r.date}|${r.mealType}`;
      const bucket = buckets.get(key);
      const entry = groupAssign.get(r.pageId);
      if (entry && bucket && entry.groupId === bucket.groupId && bucket.imageUrl) {
        entry.imageUrl = bucket.imageUrl;
      }
    }

    const enriched: Enriched[] = filtered.map((r) => {
      const c = r.lineUserId ? idx.get(r.lineUserId) : undefined;
      const g = groupAssign.get(r.pageId);
      return {
        pageId: r.pageId,
        date: r.date,
        recordedAt: r.recordedAt,
        mealType: r.mealType,
        title: r.title,
        memo: r.memo,
        kcal: r.kcal,
        P: r.P,
        F: r.F,
        C: r.C,
        imageUrl: g?.imageUrl ?? r.imageUrl,
        details: r.details,
        lineUserId: r.lineUserId || '',
        customerId: c?.pageId || null,
        customerName: c?.name || '不明',
        customerStatus: c?.foodStatus || null,
        groupId: g?.groupId || '',
      };
    });

    // 並び順：日付 desc → 食事区分（朝→昼→夕→間） → 記録時刻 desc
    enriched.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const ai = MEAL_ORDER.indexOf(a.mealType);
      const bi = MEAL_ORDER.indexOf(b.mealType);
      const av = ai < 0 ? 99 : ai;
      const bv = bi < 0 ? 99 : bi;
      if (av !== bv) return av - bv;
      return b.recordedAt.localeCompare(a.recordedAt);
    });

    // 顧客一覧（フィルタ用のセレクトボックス）も返す
    const customerList = customers
      .filter((c) => !!c.foodStatus)
      .map((c) => ({ pageId: c.pageId, name: c.name, foodStatus: c.foodStatus }));

    return NextResponse.json({
      meals: enriched,
      customers: customerList,
      range: { startDate, endDate },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
