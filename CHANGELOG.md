# CHANGELOG

## 2026-06-16 – fix(staging): lib/streakStats.ts 欠落による Vercel ビルド失敗を修正（branch: staging）
- fix: `f2a37d1` で `git add` し忘れた `lib/streakStats.ts` を追加。`computeStreakStats` を `app/api/today/route.ts` の旧実装 `computeStats` から抽出・リネームし、`app/api/stats/route.ts` と `app/api/today/route.ts` 両方の共用インポートを解決
- 影響範囲: staging ビルド（`/api/today`、`/api/stats`）の Module not found エラー修正。本番（main）は無関係
- 関連: Slack #security-alerts https://mewodas.slack.com/archives/C0B4DQNJR7F/p1781583326695989

