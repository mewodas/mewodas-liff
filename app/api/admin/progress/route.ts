import { NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { listCustomers } from '@/lib/repository/customers';
import { getTenantNotion } from '@/lib/notion';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function notionQuery(apiKey: string, dbId: string, body: Record<string, unknown>): Promise<any> {
  if (!apiKey) throw new Error('NOTION_API_KEY 未設定');
  const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

type ProgressItem = {
  pageId: string;
  name: string;
  storeId: string | null;
  foodStatus: string | null;
  today: {
    intakeKcal: number;
    intakeP: number;
    intakeF: number;
    intakeC: number;
    targetKcal: number;
    targetP: number;
    targetF: number;
    targetC: number;
    mealCount: number;
    mealTarget: number;
  };
  weight: {
    latest: number | null;
    deltaFromYesterday: number | null;
  };
  exercise: {
    todayMinutes: number;
    todayCount: number;
  };
};

export const GET = withAdminTenant(async (req) => {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const jstNow = jstToday();
    const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : jstNow;
    const today = selectedDate;
    const [todayY, todayM, todayD] = today.split('-').map(Number);
    const yesterdayDt = new Date(todayY, todayM - 1, todayD - 1);
    const yesterday = `${yesterdayDt.getFullYear()}-${String(yesterdayDt.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDt.getDate()).padStart(2, '0')}`;

    const customers = await listCustomers();
    const tenantNotion = getTenantNotion();
    const apiKey = tenantNotion.apiKey;
    const foodDbId = tenantNotion.foodDbId;

    const tenant = getCurrentTenant();
    const weightDbId = tenant.notionWeightDbId || '';
    const exerciseDbId = process.env.NOTION_EXERCISE_DB_ID || '';

    const progress: ProgressItem[] = customers.map((c) => ({
      pageId: c.pageId,
      name: c.name,
      storeId: c.storeId,
      foodStatus: c.foodStatus,
      today: {
        intakeKcal: 0,
        intakeP: 0,
        intakeF: 0,
        intakeC: 0,
        targetKcal: c.goals?.kcal || 0,
        targetP: c.goals?.P || 0,
        targetF: c.goals?.F || 0,
        targetC: c.goals?.C || 0,
        mealCount: 0,
        mealTarget: 4,
      },
      weight: {
        latest: null,
        deltaFromYesterday: null,
      },
      exercise: {
        todayMinutes: 0,
        todayCount: 0,
      },
    }));

    const indexByLineId = new Map<string, number>();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      if (c.lineUserId) indexByLineId.set(c.lineUserId, i);
    }

    // 食事・体重・運動の3フェーズは互いに独立（progress の別フィールドに書く）なので並列実行。
    // 直列だと Notion 往復＋リトライが積み上がり遅かった（顧客一覧の表示遅延の主因）。
    const phases: Promise<void>[] = [];

    // 食事記録（今日分を一括取得してクライアントで振り分け）
    phases.push((async () => {
    if (foodDbId && apiKey) {
      try {
        const results: any[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 10; page++) {
          const body: Record<string, unknown> = {
            filter: {
              and: [
                { property: '日付', date: { on_or_after: today } },
                { property: '日付', date: { on_or_before: today } },
              ],
            },
            page_size: 100,
          };
          if (cursor) body.start_cursor = cursor;
          const res = await notionQuery(apiKey, foodDbId, body);
          results.push(...(res.results || []));
          if (!res.has_more) break;
          cursor = res.next_cursor;
        }
        for (const page of results) {
          const p = page.properties;
          const lineUserId = p['LINE_UserID']?.rich_text?.[0]?.plain_text || '';
          const idx = lineUserId ? indexByLineId.get(lineUserId) : undefined;
          if (idx === undefined) continue;
          const kcal = p['カロリー_kcal']?.number || 0;
          progress[idx].today.intakeKcal += kcal;
          progress[idx].today.intakeP += p['タンパク質_g']?.number || 0;
          progress[idx].today.intakeF += p['脂質_g']?.number || 0;
          progress[idx].today.intakeC += p['炭水化物_g']?.number || 0;
          progress[idx].today.mealCount += 1;
        }
      } catch {
        // 食事DB エラーは無視してその他は継続
      }
    }
    })());

    // 体重（今日・昨日を顧客ごとに並列取得）
    phases.push((async () => {
    if (weightDbId && apiKey) {
      await runWithConcurrency(customers, 5, async (customer) => {
        if (!customer.lineUserId) return;
        const idx = indexByLineId.get(customer.lineUserId);
        if (idx === undefined) return;
        try {
          const res = await notionQuery(apiKey, weightDbId, {
            filter: {
              and: [
                { property: 'LINEユーザーID', rich_text: { equals: customer.lineUserId } },
              ],
            },
            sorts: [{ property: '日付', direction: 'descending' }],
            page_size: 5,
          });
          const entries: { date: string; weight: number }[] = (res.results || []).map((page: any) => ({
            date: page.properties['日付']?.title?.[0]?.plain_text || '',
            weight: page.properties['体重(kg)']?.number ?? null,
          })).filter((e: { date: string; weight: number }) => e.date && e.weight !== null);

          const todayEntry = entries.find((e) => e.date === today);
          const yesterdayEntry = entries.find((e) => e.date === yesterday);
          const latestEntry = entries[0] || null;

          progress[idx].weight.latest = latestEntry?.weight ?? null;
          if (todayEntry && yesterdayEntry) {
            progress[idx].weight.deltaFromYesterday = Math.round((todayEntry.weight - yesterdayEntry.weight) * 10) / 10;
          }
        } catch {
          // 体重取得エラーは個別にスキップ
        }
      });
    }
    })());

    // 運動記録（今日分を一括取得してクライアントで振り分け）
    phases.push((async () => {
    if (exerciseDbId && apiKey) {
      try {
        const results: any[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 5; page++) {
          const body: Record<string, unknown> = {
            filter: {
              and: [
                { property: '日付', date: { on_or_after: today } },
                { property: '日付', date: { on_or_before: today } },
              ],
            },
            page_size: 100,
          };
          if (cursor) body.start_cursor = cursor;
          const res = await notionQuery(apiKey, exerciseDbId, body);
          results.push(...(res.results || []));
          if (!res.has_more) break;
          cursor = res.next_cursor;
        }
        for (const page of results) {
          const p = page.properties;
          const lineUserId = p['LINEユーザーID']?.rich_text?.[0]?.plain_text || '';
          const idx = lineUserId ? indexByLineId.get(lineUserId) : undefined;
          if (idx === undefined) continue;
          const durationMin = p['時間_分']?.number || 0;
          progress[idx].exercise.todayMinutes += durationMin;
          progress[idx].exercise.todayCount += 1;
        }
      } catch {
        // 運動DB エラーは無視
      }
    }
    })());

    await Promise.all(phases);

    return NextResponse.json({ progress, today: selectedDate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
