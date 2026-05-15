// パスワード自動生成ヘルパー
// 紛らわしい文字（O/0, I/l/1）を除外して可読性確保

export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}
