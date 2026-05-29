/**
 * Neon Postgres へ監査ログマイグレーションを適用するスクリプト。
 * lib/db/migrations/*.sql をファイル名昇順で全て実行する（冪等）。
 *
 * 実行方法:
 *   DATABASE_URL=postgres://... node scripts/migrate-audit-log.mjs
 *
 * 接続文字列は DATABASE_URL / POSTGRES_URL / POSTGRES_PRISMA_URL の順に探す。
 * Vercel CLI 経由の場合:
 *   vercel env pull .env.local && node scripts/migrate-audit-log.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!url) {
  console.error(
    'DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) が未設定です。' +
      '\n.env.local を読み込んでから再実行してください。'
  );
  process.exit(1);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, '../lib/db/migrations');

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const sql = neon(url);

for (const file of files) {
  const sqlText = readFileSync(join(migrationsDir, file), 'utf8');
  const statements = sqlText
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    for (const stmt of statements) {
      await sql.query(stmt);
    }
    console.log(`migration ${file}: 完了 (${statements.length} 文)`);
  } catch (err) {
    console.error(`migration ${file}: 失敗`, err);
    process.exit(1);
  }
}

console.log('全マイグレーション完了');
