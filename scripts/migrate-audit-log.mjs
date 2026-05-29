/**
 * Neon Postgres へ監査ログテーブルを作成するマイグレーションスクリプト。
 * 冪等 (IF NOT EXISTS) なので何度実行しても安全。
 *
 * 実行方法:
 *   DATABASE_URL=postgres://... node scripts/migrate-audit-log.mjs
 *
 * 接続文字列は DATABASE_URL / POSTGRES_URL / POSTGRES_PRISMA_URL の順に探す。
 * Vercel CLI 経由の場合:
 *   vercel env pull .env.local && node scripts/migrate-audit-log.mjs
 */

import { readFileSync } from 'node:fs';
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
const sql_text = readFileSync(
  join(__dir, '../lib/db/migrations/001_audit_log.sql'),
  'utf8'
);

const sql = neon(url);

// Neon の HTTP ドライバは複数文を一度に実行できず、tagged-template か
// sql.query() のみを受け付ける。';' で分割して 1 文ずつ実行する（冪等 DDL 前提）。
const statements = sql_text
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

try {
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log(`migration 001_audit_log: 完了 (${statements.length} 文)`);
} catch (err) {
  console.error('migration 001_audit_log: 失敗', err);
  process.exit(1);
}
