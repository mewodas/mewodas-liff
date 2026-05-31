// CSP 違反レポート収集エンドポイント（Report-Only の report-uri 受け口）。
//
// 目的: CSP を enforce 化する前に、LIFF/管理画面で実際に何がブロックされるか（blocked-uri /
//   violated-directive）を実データで収集し、allowlist を正確に完成させる。
//   過去2回 enforce 化が「failed to fetch」で失敗したため、推測ではなく実違反で詰める。
//
// 無認証（ブラウザが自動 POST する）。proxy の CSRF 対象外（/api/admin・/api/store ではない）。
// 乱用対策: 本文サイズ上限 + 軽量処理のみ。

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CSP レポートは小さい。極端に大きい本文は破棄（DoS/濫用対策）。
const MAX_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!raw || raw.length > MAX_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    let report: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(raw);
      // report-uri 形式: { "csp-report": {...} } / report-to 形式: [{ body: {...} }]
      report = parsed['csp-report'] || (Array.isArray(parsed) ? parsed[0]?.body : parsed) || parsed;
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const blockedUri = String(report?.['blocked-uri'] ?? report?.['blockedURL'] ?? '').slice(0, 300);
    const directive = String(report?.['violated-directive'] ?? report?.['effectiveDirective'] ?? '').slice(0, 100);
    const documentUri = String(report?.['document-uri'] ?? report?.['documentURL'] ?? '').slice(0, 300);

    // 'inline'/'eval' や about:/blob: のノイズは記録不要（allowlist 対象は外部 https のみ）
    if (blockedUri && /^https?:\/\//.test(blockedUri)) {
      console.warn('[csp-violation]', JSON.stringify({ directive, blockedUri, documentUri }));
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setLevel('warning');
          scope.setTag('csp_directive', directive);
          scope.setTag('csp_blocked_host', (() => { try { return new URL(blockedUri).host; } catch { return blockedUri; } })());
          scope.setExtra('blockedUri', blockedUri);
          scope.setExtra('documentUri', documentUri);
          Sentry.captureMessage(`CSP violation: ${directive} -> ${blockedUri}`);
        });
      }
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
