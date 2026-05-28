// デモ/サンプル顧客の食事・体重・個人シートを「今日基準」で再生成する共有関数。
//
// 対象: LINEユーザーID が `SAMPLE_` または `DEMO_` で始まる顧客（山田 花子）。
// 動作:
//   1. 既存の食事レコード・体重レコードを archived:true で論理削除
//   2. 今日基準の直近7日分の食事レコードを再投入
//   3. 今日基準の直近9日分の体重レコードを再投入
//   4. 個人シート（食事記録リンク先）のテーブルを今日基準の日付で作り直す
// 冪等: 毎日の cron で繰り返し呼んでも問題ない

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

async function notionReq(
  method: string,
  apiKey: string,
  path: string,
  payload?: object
): Promise<any> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function jstDateOffset(daysAgo: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToJpMd(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日`;
}

type DbIds = { customerDbId: string; foodDbId: string; weightDbId: string };

type SampleCustomerInfo = {
  pageId: string;
  lineUserId: string;
  foodSheetUrl: string | null;
};

async function findSampleCustomers(
  apiKey: string,
  customerDbId: string
): Promise<SampleCustomerInfo[]> {
  const results: SampleCustomerInfo[] = [];
  for (const prefix of ['SAMPLE_', 'DEMO_']) {
    const res = await notionReq('POST', apiKey, `/databases/${customerDbId}/query`, {
      filter: { property: 'LINEユーザーID', rich_text: { starts_with: prefix } },
      page_size: 10,
    });
    for (const page of res.results || []) {
      const lineUserId: string =
        page.properties?.['LINEユーザーID']?.rich_text?.[0]?.plain_text || '';
      const url: string | null = page.properties?.['食事記録リンク']?.url || null;
      if (lineUserId) {
        results.push({ pageId: page.id as string, lineUserId, foodSheetUrl: url });
      }
    }
  }
  return results;
}

async function archiveAllSampleFoodRecords(
  apiKey: string,
  foodDbId: string,
  lineUserId: string
): Promise<number> {
  let archived = 0;
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: { property: 'LINE_UserID', rich_text: { equals: lineUserId } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionReq('POST', apiKey, `/databases/${foodDbId}/query`, body);
    const promises = (res.results || []).map((p: { id: string }) =>
      notionReq('PATCH', apiKey, `/pages/${p.id}`, { archived: true }).catch(() => null)
    );
    await Promise.all(promises);
    archived += (res.results || []).length;
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return archived;
}

async function archiveAllSampleWeightRecords(
  apiKey: string,
  weightDbId: string,
  lineUserId: string
): Promise<number> {
  let archived = 0;
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: { property: 'LINEユーザーID', rich_text: { equals: lineUserId } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionReq('POST', apiKey, `/databases/${weightDbId}/query`, body);
    const promises = (res.results || []).map((p: { id: string }) =>
      notionReq('PATCH', apiKey, `/pages/${p.id}`, { archived: true }).catch(() => null)
    );
    await Promise.all(promises);
    archived += (res.results || []).length;
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return archived;
}

type MealEntry = { type: string; kcal: number; P: number; F: number; C: number; memo: string };

const MEALS_PER_DAY: MealEntry[][] = [
  [
    { type: '朝食', kcal: 320, P: 18, F: 8, C: 42, memo: '納豆ご飯・味噌汁・ゆで卵' },
    { type: '昼食', kcal: 540, P: 32, F: 14, C: 68, memo: '鶏むね肉と野菜の炒め定食・ご飯150g' },
    { type: '夕食', kcal: 480, P: 28, F: 12, C: 58, memo: '豆腐の煮物・サーモン塩焼き・ほうれん草おひたし' },
    { type: '間食', kcal: 160, P: 8, F: 3, C: 24, memo: 'ヨーグルト・バナナ半分' },
  ],
  [
    { type: '朝食', kcal: 280, P: 14, F: 6, C: 38, memo: 'オートミール・プロテインドリンク' },
    { type: '昼食', kcal: 510, P: 29, F: 13, C: 62, memo: 'サバの味噌煮定食・ご飯130g・サラダ' },
    { type: '夕食', kcal: 550, P: 35, F: 16, C: 60, memo: '鶏胸肉グリル・ブロッコリー・スープ' },
  ],
  [
    { type: '朝食', kcal: 350, P: 20, F: 9, C: 44, memo: '卵かけご飯・わかめ味噌汁・海苔' },
    { type: '昼食', kcal: 490, P: 26, F: 12, C: 64, memo: 'ざるそば・鶏サラダ・温泉卵' },
    { type: '夕食', kcal: 520, P: 30, F: 14, C: 56, memo: 'マグロ刺身・冷奴・野菜スープ・ご飯100g' },
    { type: '間食', kcal: 130, P: 6, F: 2, C: 22, memo: 'りんご・チーズ1枚' },
  ],
  [
    { type: '朝食', kcal: 310, P: 16, F: 7, C: 40, memo: 'ご飯・焼き鮭・ほうれん草炒め' },
    { type: '昼食', kcal: 530, P: 31, F: 15, C: 60, memo: 'カレーライス（中辛）・野菜サラダ' },
    { type: '夕食', kcal: 470, P: 28, F: 11, C: 55, memo: '蒸し鶏・もずく酢・豆腐みそ汁' },
  ],
  [
    { type: '朝食', kcal: 340, P: 19, F: 8, C: 42, memo: 'オムレツ・全粒パン・野菜スープ' },
    { type: '昼食', kcal: 560, P: 33, F: 16, C: 62, memo: '牛しゃぶサラダ定食・雑穀ご飯150g' },
    { type: '夕食', kcal: 460, P: 27, F: 10, C: 54, memo: '豚ヒレ肉ソテー・キャベツ千切り・きのこスープ' },
    { type: '間食', kcal: 140, P: 7, F: 3, C: 20, memo: 'プロテインバー' },
  ],
  [
    { type: '朝食', kcal: 300, P: 15, F: 7, C: 38, memo: 'ご飯・海苔・みそ汁・目玉焼き' },
    { type: '昼食', kcal: 500, P: 28, F: 13, C: 58, memo: '冷しゃぶうどん・温泉卵・ゆでほうれん草' },
    { type: '夕食', kcal: 530, P: 32, F: 14, C: 60, memo: '鶏鍋（豆腐・野菜たっぷり）・ご飯100g' },
  ],
  [
    { type: '朝食', kcal: 360, P: 22, F: 9, C: 44, memo: 'ギリシャヨーグルト・グラノーラ・いちご' },
    { type: '昼食', kcal: 480, P: 25, F: 12, C: 58, memo: 'おにぎり2個・鶏むね唐揚げ・サラダ' },
    { type: '夕食', kcal: 500, P: 30, F: 13, C: 56, memo: 'アジの塩焼き・ひじき煮・ご飯120g・味噌汁' },
    { type: '間食', kcal: 150, P: 8, F: 4, C: 20, memo: 'ミックスナッツ・プロテインドリンク' },
  ],
];

const SHEET_WEIGHTS = [58.0, 57.8, 57.9, 57.6, 57.5, 57.7, 57.4, 57.3, 57.5, 57.2];
const EXERCISE_PATTERN = [true, false, true, true, false, true, false, true, true, false];
const EXERCISE_CONTENTS = [
  'ランニング30分',
  '',
  '筋トレ 上半身',
  'ウォーキング40分',
  '',
  '筋トレ 下半身',
  '',
  'ヨガ30分',
  'ランニング25分',
  '',
];
const DB_WEIGHTS = [58.0, 57.8, 57.9, 57.6, 57.5, 57.7, 57.4, 57.3, 57.5];

async function seedFoodRecords(
  apiKey: string,
  foodDbId: string,
  lineUserId: string
): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (let day = 0; day < 7; day++) {
    const dateStr = jstDateOffset(6 - day);
    const meals = MEALS_PER_DAY[day] || MEALS_PER_DAY[0];
    for (const meal of meals) {
      promises.push(
        notionReq('POST', apiKey, '/pages', {
          parent: { database_id: foodDbId },
          properties: {
            食事メモ: { title: [{ text: { content: `${meal.type} (サンプル)` } }] },
            LINE_UserID: { rich_text: [{ text: { content: lineUserId } }] },
            日付: { date: { start: dateStr } },
            食事区分: { select: { name: meal.type } },
            カロリー_kcal: { number: meal.kcal },
            タンパク質_g: { number: meal.P },
            脂質_g: { number: meal.F },
            炭水化物_g: { number: meal.C },
            食材メモ: { rich_text: [{ text: { content: meal.memo } }] },
          },
        }).catch(() => null)
      );
    }
  }
  await Promise.all(promises);
}

async function seedWeightRecords(
  apiKey: string,
  weightDbId: string,
  lineUserId: string
): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (let day = 0; day < 9; day++) {
    const dateStr = jstDateOffset(8 - day);
    promises.push(
      notionReq('POST', apiKey, '/pages', {
        parent: { database_id: weightDbId },
        properties: {
          日付: { title: [{ text: { content: dateStr } }] },
          '体重(kg)': { number: DB_WEIGHTS[day] },
          LINEユーザーID: { rich_text: [{ text: { content: lineUserId } }] },
          顧客名: { rich_text: [{ text: { content: '山田 花子' } }] },
          入力経路: { select: { name: 'LIFF' } },
        },
      }).catch(() => null)
    );
  }
  await Promise.all(promises);
}

// 個人シートの古いテーブルを今日基準で作り直す。
// 既存ページのブロックを取得して table ブロックを特定し、archived:true では
// ブロック削除できないため（Notion は blocks に PATCH archived を持たない）、
// ページごと新規作成してリンクを付け替える方式を採用する。
async function rebuildFoodSheetPage(
  apiKey: string,
  oldSheetUrl: string | null,
  parentPageId: string
): Promise<string> {
  // 旧ページをアーカイブ（URL から page_id を抽出）
  if (oldSheetUrl) {
    try {
      const rawId = oldSheetUrl.replace(/.*notion\.so\//, '').split('?')[0].replace(/-/g, '');
      const withDashes =
        rawId.length === 32
          ? `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`
          : rawId;
      await notionReq('PATCH', apiKey, `/pages/${withDashes}`, { archived: true }).catch(() => null);
    } catch {
      // アーカイブ失敗は非致命的
    }
  }

  const tableRows = [];
  // ヘッダー行
  tableRows.push({
    type: 'table_row',
    table_row: {
      cells: [
        [{ type: 'text', text: { content: '日付' } }],
        [{ type: 'text', text: { content: '体重(kg)' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '' } }],
        [{ type: 'text', text: { content: '運動' } }],
        [{ type: 'text', text: { content: '運動内容' } }],
      ],
    },
  });
  // データ行（直近10日: 9日前〜0日前）
  for (let i = 0; i < 10; i++) {
    const daysAgo = 9 - i;
    const dateStr = jstDateOffset(daysAgo);
    const label = isoToJpMd(dateStr);
    const exercised = EXERCISE_PATTERN[i];
    tableRows.push({
      type: 'table_row',
      table_row: {
        cells: [
          [{ type: 'text', text: { content: label } }],
          [{ type: 'text', text: { content: String(SHEET_WEIGHTS[i]) } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: '' } }],
          [{ type: 'text', text: { content: exercised ? '✅' : '' } }],
          [{ type: 'text', text: { content: exercised ? EXERCISE_CONTENTS[i] : '' } }],
        ],
      },
    });
  }

  const page = await notionReq('POST', apiKey, '/pages', {
    parent: { type: 'page_id', page_id: parentPageId },
    properties: {
      title: [{ type: 'text', text: { content: '山田 花子 個人シート（サンプル）' } }],
    },
    children: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '📝 記録' } }],
        },
      },
      {
        type: 'table',
        table: {
          table_width: 11,
          has_column_header: true,
          has_row_header: false,
          children: tableRows,
        },
      },
    ],
  });
  return page.id as string;
}

export type RefreshResult = {
  tenantId: string;
  customersProcessed: number;
  foodArchived: number;
  weightArchived: number;
  sheetRebuilt: boolean;
  error?: string;
};

export async function refreshDemoDataForTenant(
  tenantId: string,
  dbIds: DbIds,
  notionApiKey: string,
  parentPageId: string
): Promise<RefreshResult> {
  const customers = await findSampleCustomers(notionApiKey, dbIds.customerDbId);

  if (customers.length === 0) {
    return { tenantId, customersProcessed: 0, foodArchived: 0, weightArchived: 0, sheetRebuilt: false };
  }

  let totalFoodArchived = 0;
  let totalWeightArchived = 0;
  let sheetRebuilt = false;

  for (const customer of customers) {
    const [foodArchived, weightArchived] = await Promise.all([
      archiveAllSampleFoodRecords(notionApiKey, dbIds.foodDbId, customer.lineUserId),
      archiveAllSampleWeightRecords(notionApiKey, dbIds.weightDbId, customer.lineUserId),
    ]);
    totalFoodArchived += foodArchived;
    totalWeightArchived += weightArchived;

    await Promise.all([
      seedFoodRecords(notionApiKey, dbIds.foodDbId, customer.lineUserId),
      seedWeightRecords(notionApiKey, dbIds.weightDbId, customer.lineUserId),
    ]);

    // 個人シートを今日基準で作り直してリンクを更新
    const newSheetPageId = await rebuildFoodSheetPage(
      notionApiKey,
      customer.foodSheetUrl,
      parentPageId
    );
    const newSheetUrl = `https://www.notion.so/${newSheetPageId.replace(/-/g, '')}`;
    await notionReq('PATCH', notionApiKey, `/pages/${customer.pageId}`, {
      properties: { 食事記録リンク: { url: newSheetUrl } },
    });
    sheetRebuilt = true;
  }

  return {
    tenantId,
    customersProcessed: customers.length,
    foodArchived: totalFoodArchived,
    weightArchived: totalWeightArchived,
    sheetRebuilt,
  };
}
