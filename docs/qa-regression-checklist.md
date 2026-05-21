# QA 回帰チェックリスト

最終更新: 2026-05-21（初版）
担当: QA エージェント（fitmeal-qa）

---

## 凡例

- [A] 自動検証可能（curl / API）
- [M] ブラウザ手動が必要
- CORE: 毎リリース必須確認
- SCOPE: 影響範囲がある場合のみ

---

## 顧客 LIFF

### ログイン・認証

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| L1 | LIFF 初期化 → LINE プロフィール取得 → /home 表示 | [M] | CORE |
| L2 | 未登録 LINE ID → /onboard への誘導 | [M] | CORE |
| L3 | 無認証で API 直叩き → 401 返却 | [A] | CORE |
| L4 | 偽トークンで API 直叩き → 401 返却 | [A] | CORE |

### 申し込みフォーム認証（/home/register）— 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| REG1 | /api/liff/register: Authorization ヘッダーなし → 401 | [A] | CORE |
| REG2 | /api/liff/register: 偽アクセストークン → 401 | [A] | CORE |
| REG3 | /api/liff/register: LINE 無効トークン（失効済み） → 401 | [A] | CORE |
| REG4 | LINE 内ブラウザでフォームを開き、全項目入力 → 登録完了画面に遷移 | [M] | CORE |
| REG5 | 登録済み LINE ID で再送信 → alreadyRegistered: true の完了画面表示 | [M] | CORE |
| REG6 | 既存 LIFF ルート（/api/day 等）が IDトークン方式のまま動作する | [M] | CORE |
| REG7 | 目標体重・目標達成日を空欄で送信 → 正常登録できること（任意フィールド） | [M] | CORE |
| REG8 | アクセストークン null 時（LINE 外ブラウザは設計外） → triggerReauth() でログイン遷移・ループしない | [M] | SCOPE |

### 撮影・食事記録

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| R1 | /record → 写真アップロード → AI 解析 → /home へ遷移 | [M] | CORE |
| R2 | /record → 手動入力 → 記録保存 → /home へ遷移 | [M] | CORE |
| R3 | /api/record/analyze: 無認証 → 401 | [A] | CORE |
| R4 | /api/record/manual: 無認証 → 401 | [A] | CORE |
| R5 | mealType 不正値 → 400 | [A] | CORE |

### ホーム・記録閲覧

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| H1 | /home → 本日の記録カード表示 | [M] | CORE |
| H2 | /history → 過去の食事一覧表示 | [M] | CORE |
| H3 | /weekly → 週次レポート表示 | [M] | CORE |

### AI 献立（/meal-plan）— 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| MP1 | 「献立を作る」ボタン押下 → 結果表示直後に画面が案1先頭から表示 | [M] | SCOPE |
| MP2 | いずれかの案の「この食事にする」タップ → RecipeSheet が開く | [M] | SCOPE |
| MP3 | RecipeSheet: 記録ボタンがシート下部に固定、手順テキストに重ならない | [M] | SCOPE |
| MP4 | RecipeSheet: シートをスクロールしても記録ボタンが隠れない | [M] | SCOPE |
| MP5 | RecipeSheet: 記録ボタンをタップ → 記録完了 → /menu へ遷移 | [M] | SCOPE |
| MP6 | /api/meal-plan: 無認証 → 401 | [A] | SCOPE |
| MP7 | /api/meal-plan: 偽トークン → 401 | [A] | SCOPE |
| MP8 | /api/meal-plan/recipe: title 未指定 → 400 | [A] | SCOPE |
| MP9 | /api/record/manual: 無認証 → 401（AI 献立からの記録 API） | [A] | SCOPE |

### プロフィール・設定

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| P1 | /profile → 表示・更新保存 | [M] | CORE |
| P2 | /goals → 目標 PFC 表示・更新 | [M] | CORE |
| P3 | /weight → 体重記録 | [M] | CORE |

---

## 管理画面

### 顧客管理

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| A1 | /admin/customers → 顧客一覧表示 | [M] | CORE |
| A2 | /admin/customers/[id] → 顧客詳細・食事記録一覧表示 | [M] | CORE |
| A3 | /admin: 無認証アクセス → ログイン画面へ | [A] | CORE |

### 分析・AI 解析

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| N1 | /admin/analysis → 日別カロリーグラフ表示 | [M] | CORE |
| N2 | AI 解析 → Gemini 解析結果の表示 | [M] | CORE |

### 店舗・テナント管理

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| S1 | /store → 店舗ダッシュボード表示 | [M] | CORE |
| S2 | /admin/tenants → マルチテナント一覧（master のみ） | [M] | CORE |

---

## バックエンド・非同期処理

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| B1 | cron: 前日レポート送信ジョブがエラーなく完了 | [A] ログ確認 | CORE |
| B2 | Gemini 解析: 画像記録の AI 解析が正常完了 | [M] | CORE |
| B3 | Notion 書き込み: 食事記録が Notion DB に保存される | [A] | CORE |

---

## リリース履歴（QA 実施済み）

| リリース日 | 変更内容 | commit | 判定 |
|-----------|---------|--------|------|
| 2026-05-21 | 申し込みフォーム認証方式 IDトークン→アクセストークンに変更 | 61b94a5 | 条件付き GO（社長手動確認待ち） |
| 2026-05-21 | AI献立 UI 3点修正（スクロール位置・ボタン位置・遷移先） | 602ba9c | 条件付き GO |
| 2026-05-21 | 認証オンボーディング画面のフッター非表示 | — | GO（前回） |

---

## 既知の罠・注意事項

- **staging テスト顧客の LINE ID 重複**: 食事一覧が 0 件になる症状。グラフは出るが一覧だけ空の場合はこれを疑う
- `/api/meal-plan/recipe` は設計上認証不要（Gemini API 直叩き、顧客 DB へのアクセスなし）
- `resultTopRef.scrollIntoView` は LIFF 内の iframe スクロールに依存するため、LINE アプリ内ブラウザでの確認が必須
- `/api/liff/register` のみアクセストークン方式（withLiffTenantAccessToken）。他の LIFF ルートは引き続き IDトークン方式（withLiffTenant）。混同注意
- `liff.getAccessToken()` は LINE 外ブラウザで null を返す。設計外ユースケースのため LINE 内ブラウザのみサポート対象
- register フォームの 401 リトライは最大 1 回。その後 `liff.login()` でページ離脱するため無限ループしない設計
- アクセストークンのサーバー側キャッシュは 1 分 TTL（IDトークン側は 5 分 TTL）。高頻度テストでは同じトークンがキャッシュされる場合がある
