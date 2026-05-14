#!/usr/bin/env node
// 管理者パスワードのハッシュを生成します。
// 使い方:  node scripts/hash-admin-password.mjs "your-password"
// 出力された文字列を Vercel の環境変数 ADMIN_PASSWORD_HASH にセットしてください。

import { scryptSync, randomBytes } from 'crypto';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-admin-password.mjs <password>');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64);
console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
