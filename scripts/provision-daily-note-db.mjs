/**
 * 日次備考（その日1件の自由メモ）機能のための Notion リソースをプロビジョニングする。
 *
 * やること（冪等）:
 *   1. FitMeal テナントDB に rich_text 列「Notion 日次備考DB ID」を用意（無ければ追加）
 *   2. 対象テナント行が未設定なら「{ジム名} 日次備考」DB を親ページ配下に作成
 *   3. 作成した DB ID をテナント行の「Notion 日次備考DB ID」に書き込む
 *
 * アプリと同じ Integration（NOTION_API_KEY）で作るので、作成 DB へのアクセス権が確実に通る。
 *
 * 実行:
 *   node scripts/provision-daily-note-db.mjs staging   # 既定
 *   node scripts/provision-daily-note-db.mjs prod
 *
 * NOTION_API_KEY は環境変数 → .env.local → .env.staging の順に探す。
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');

const NOTION_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

// 共通: FitMeal テナント管理 DB（本番・staging 共有）
const TENANTS_DB_ID = '4468b0213fd04328b93c13e71fd3dde7';
const DAILY_NOTE_COLUMN = 'Notion 日次備考DB ID';

const TARGETS = {
  staging: {
    label: 'staging (mewodas-staging)',
    tenantId: 'mewodas-staging',
    // テナント行ページ ID（docs/STAGING.md 記載の確定値）
    tenantPageId: '362a47a8-738d-8120-8734-e3507564ba55',
    // 理想は staging 親ページ（🧪 FitMeal ステージング環境）配下だが、現状 Integration
    // 「メヲダス_GAS連携」が staging 親ページに未接続のため、その配下に新規 DB を作れない
    // （個別 staging DB は共有済みだが親ページは未共有）。よって作成は prod 親ページ配下に
    // フォールバックする。別 DB なのでデータ分離は保たれる（staging 行がこの DB を指す）。
    // Integration を staging 親に接続すれば理想配置で作成できる。作成後に Notion 上で
    // staging 親へドラッグ移動しても DB ID は不変なのでコード/設定変更は不要。
    parentPageId: '362a47a8-738d-8150-9649-fe2b9973204b',
    fallbackParentPageId: '34ea47a8738d8155a2b1e9f4607e8986',
    dbTitle: 'メヲダス（ステージング） 日次備考',
  },
  prod: {
    label: 'prod (mewodas)',
    tenantId: 'mewodas',
    tenantPageId: null, // tenant_id から検索する
    // 新 DB を置く親ページ（🥗 食事管理システム｜メヲダス五反田店 = FITMEAL_TENANTS_PARENT_PAGE_ID）
    parentPageId: '34ea47a8738d8155a2b1e9f4607e8986',
    dbTitle: 'メヲダス 五反田店 日次備考',
  },
};

function loadApiKey() {
  if (process.env.NOTION_API_KEY) return process.env.NOTION_API_KEY;
  for (const f of ['.env.local', '.env.staging', '.env']) {
    const p = join(repoRoot, f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*NOTION_API_KEY\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) return v;
      }
    }
  }
  return '';
}

const API_KEY = loadApiKey();
if (!API_KEY) {
  console.error('NOTION_API_KEY が見つかりません（環境変数 / .env.local / .env.staging を確認）');
  process.exit(1);
}

async function notion(method, path, payload) {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Notion ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function ensureColumn() {
  const db = await notion('GET', `/databases/${TENANTS_DB_ID}`);
  if (db.properties && db.properties[DAILY_NOTE_COLUMN]) {
    console.log(`[col] 列「${DAILY_NOTE_COLUMN}」は既に存在`);
    return;
  }
  await notion('PATCH', `/databases/${TENANTS_DB_ID}`, {
    properties: { [DAILY_NOTE_COLUMN]: { rich_text: {} } },
  });
  console.log(`[col] 列「${DAILY_NOTE_COLUMN}」を追加`);
}

async function findTenantPageId(tenantId) {
  const data = await notion('POST', `/databases/${TENANTS_DB_ID}/query`, {
    filter: { property: 'tenant_id', rich_text: { equals: tenantId } },
    page_size: 1,
  });
  const row = (data.results || [])[0];
  return row?.id ?? null;
}

async function getExistingDailyNoteDbId(pageId) {
  const page = await notion('GET', `/pages/${pageId}`);
  return page?.properties?.[DAILY_NOTE_COLUMN]?.rich_text?.[0]?.plain_text || '';
}

async function createDailyNoteDb(parentPageId, title) {
  const res = await notion('POST', '/databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: title } }],
    properties: {
      日付: { title: {} },
      LINEユーザーID: { rich_text: {} },
      顧客名: { rich_text: {} },
      備考: { rich_text: {} },
      入力経路: {
        select: {
          options: [
            { name: 'LIFF', color: 'green' },
            { name: '管理画面', color: 'blue' },
          ],
        },
      },
    },
  });
  return res.id;
}

async function main() {
  const target = (process.argv[2] || 'staging').toLowerCase();
  const cfg = TARGETS[target];
  if (!cfg) {
    console.error(`不明なターゲット: ${target}（staging / prod のいずれか）`);
    process.exit(1);
  }
  console.log(`=== 日次備考プロビジョニング: ${cfg.label} ===`);

  await ensureColumn();

  const pageId = cfg.tenantPageId || (await findTenantPageId(cfg.tenantId));
  if (!pageId) {
    console.error(`テナント行が見つかりません（tenant_id=${cfg.tenantId}）`);
    process.exit(1);
  }
  console.log(`[row] テナント行ページ: ${pageId}`);

  const existing = await getExistingDailyNoteDbId(pageId);
  if (existing) {
    console.log(`[skip] 既に日次備考DBが割当済み: ${existing}`);
    console.log('完了（変更なし）');
    return;
  }

  let dbId;
  try {
    dbId = await createDailyNoteDb(cfg.parentPageId, cfg.dbTitle);
    console.log(`[db] 日次備考DB を作成: ${dbId}（"${cfg.dbTitle}" / 親=${cfg.parentPageId}）`);
  } catch (e) {
    const noAccess = /object_not_found|Could not find page/.test(e.message);
    if (!noAccess || !cfg.fallbackParentPageId) throw e;
    console.warn(`[warn] 親ページ ${cfg.parentPageId} に作成できず（Integration 未接続）。フォールバック親で作成します。`);
    dbId = await createDailyNoteDb(cfg.fallbackParentPageId, cfg.dbTitle);
    console.log(`[db] 日次備考DB を作成: ${dbId}（"${cfg.dbTitle}" / 親=${cfg.fallbackParentPageId} ※フォールバック）`);
  }

  await notion('PATCH', `/pages/${pageId}`, {
    properties: {
      [DAILY_NOTE_COLUMN]: { rich_text: [{ type: 'text', text: { content: dbId } }] },
    },
  });
  console.log(`[row] テナント行に DB ID を記入`);
  console.log('完了');
}

main().catch((e) => {
  console.error('失敗:', e.message);
  process.exit(1);
});
