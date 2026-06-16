# CHANGELOG

## 2026-06-16 – fix(staging): lib/streakStats.ts 欠落による Vercel ビルド失敗を修正（branch: staging）
- fix: `f2a37d1` で `git add` し忘れた `lib/streakStats.ts` を追加。`computeStreakStats` を `app/api/today/route.ts` の旧実装 `computeStats` から抽出・リネームし、`app/api/stats/route.ts` と `app/api/today/route.ts` 両方の共用インポートを解決
- 影響範囲: staging ビルド（`/api/today`、`/api/stats`）の Module not found エラー修正。本番（main）は無関係
- 関連: Slack #security-alerts https://mewodas.slack.com/archives/C0B4DQNJR7F/p1781583326695989

## 2026-06-15 – perf(LIFF): ホーム表示速度の改善４点（予測キャッシュ/ファーストビュー優先/画像遅延/予測並列）（branch: staging）
- perf(#1 予測キャッシュ): `/api/predict-weight` にサーバ側キャッシュを追加（`lib/cache`、ユーザー×日付キー・TTL30分）。Gemini呼び出しと３０日Notionクエリを丸ごとスキップ。体重/運動の保存は `invalidate('')` でこのキャッシュも消えるため保存直後は再計算。データ不足/成功の両分岐を payload に統一してキャッシュ
- perf(#2 ファーストビュー優先): `/api/today` に `?stats=0` を追加し、ホームは30日集計（連続記録バッジ）を待たずに今日の食事・目標を返す。バッジ統計は新設 `/api/stats` から別途取得（`lib/streakStats.ts` に `computeStreakStats` を抽出して共用）。他ページ（badges/prediction/exercise/meal-detail）は従来どおりフル版で後方互换。`LiffGate` はバッジ用に独立 `stats` state＋`/api/stats` 取得 effect（今日基準・日付ナビで再取得しない）
- perf(#3 画像遅延): `MealListSection` の食事画像 `<img>` に `loading="lazy"` / `decoding="async"` を付与
- perf(#4 予測並列化): `LiffGate` の予測 effect が `data`(today) 完了を待っていたのを解消し userId+今日 で並列発火。`data` 依存の代わりに明示的な `predictReloadKey` を導入（体重/運動/食事の保存・削除時に increment して再取得＝従来の更新挙動を維持）
- 影響範囲: 顧客側 LIFF（/home の初期表示・予測ブロック）。Notion DB/スキーマ変更なし。`/api/today` は後方互换（デフォルトは従来どおり stats 同梱）
- 検証: `tsc --noEmit` クリーン / `next build` 成功（`/api/stats` 追加を確認）/ `vitest` 43件パス
