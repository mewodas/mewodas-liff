// Sentry redactEvent の PII/秘密情報スクラブ回帰テスト。
// 健康データ写真・認証トークン・セッション Cookie が Sentry に送られないことを保証。

import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { redactEvent } from '@/lib/sentry';

const ev = (o: object) => o as unknown as ErrorEvent;

describe('redactEvent — PII/秘密情報スクラブ', () => {
  it('画像 data URI を伏せる（キー保持・JSON を壊さない）', () => {
    const out = redactEvent(ev({ extra: { image: 'data:image/png;base64,AAAABBBBCCCCDDDD' } }));
    const s = JSON.stringify(out);
    expect(out).not.toBeNull(); // 旧実装は JSON 破壊→unredacted フォールバックしていた
    expect(s).not.toContain('data:image/png;base64,AAAABBBBCCCCDDDD');
    expect(s).toContain('[REDACTED]');
  });

  it('Bearer トークンを伏せる', () => {
    const s = JSON.stringify(redactEvent(ev({ request: { headers: { authorization: 'Bearer eyJhbGciOiJ.payload.signature123' } } })));
    expect(s).not.toContain('eyJhbGciOiJ.payload.signature123');
    expect(s).toContain('[REDACTED]');
  });

  it('Cookie ヘッダごと伏せる', () => {
    const s = JSON.stringify(redactEvent(ev({ extra: { cookie: 'admin_session=abc.def123signature; other=1' } })));
    expect(s).not.toContain('abc.def123signature');
    expect(s).toContain('[REDACTED]');
  });

  it('自由文字列中の admin_session= も伏せる', () => {
    const s = JSON.stringify(redactEvent(ev({ message: 'failed with admin_session=secrettoken999 in url' })));
    expect(s).not.toContain('secrettoken999');
    expect(s).toContain('admin_session=[REDACTED]');
  });

  it('長い base64 を伏せる', () => {
    const big = 'A'.repeat(300);
    const s = JSON.stringify(redactEvent(ev({ extra: { blob: big } })));
    expect(s).not.toContain(big);
    expect(s).toContain('[BASE64_REDACTED]');
  });

  it('通常のメッセージ/テナント名は保持する', () => {
    const s = JSON.stringify(redactEvent(ev({ message: 'normal error', extra: { tenant: 'mewodas' } })));
    expect(s).toContain('normal error');
    expect(s).toContain('mewodas');
  });
});
