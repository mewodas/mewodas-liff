# QA 回帰チェックリスト

最終更新: 2026-05-22（セルフサーブ・オンボーディング Phase 1 5bd2977 追加）
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
| L2 | 未登録 LINE ID → /home/register への誘導（LiffGate 経由） | [M] | CORE |
| L3 | 無認証で API 直叩き → 401 返却 | [A] | CORE |
| L4 | 偽トークンで API 直叩き → 401 返却 | [A] | CORE |

### 申し込みフォーム・登録フロー（/home/register）— 2026-05-21 追加・更新

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

### オンボーディングツアー（/record・/exercise・/weight）— 2026-05-21 吹き出し化

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| TUR1 | /record を初回起動 → 吹き出し型ツアーが表示される（黄色い矢印なし） | [M] | CORE |
| TUR2 | /exercise を初回起動 → 吹き出し型ツアーが表示される | [M] | CORE |
| TUR3 | /weight を初回起動 → 吹き出し型ツアーが表示される | [M] | CORE |
| TUR4 | ツアーの白い三角の尾（tail）が対象要素を指している | [M] | CORE |
| TUR5 | ツアー吹き出しの「次へ」「完了」でツアーが進行・終了する | [M] | CORE |

### 廃止ルート・リダイレクト — 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| DEP1 | POST /api/onboard/redeem → 410 + 廃止案内メッセージ | [A] | CORE |
| DEP2 | GET /api/onboard/redeem → 405（POSTのみ受け付け） | [A] | CORE |
| DEP3 | /onboard → 307 → /home/register に最終着地（200） | [A] | CORE |
| DEP4 | /home/onboard → HTML内 NEXT_REDIRECT で /home/register に遷移（ブラウザで確認） | [M] | SCOPE |
| DEP5 | /home/register ・/home/onboard・/onboard でフッターナビが非表示 | [M] | CORE |

### 管理画面 追加確認 — 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| ADM1 | /admin → 「ユーザー招待フォームをコピー」ボタンが存在する | [M] | CORE |
| ADM2 | 「ユーザー招待フォームをコピー」クリック → URL+テンプレ文がクリップボードにコピーされる | [M] | CORE |
| ADM3 | /admin/customers/[id] → 顧客詳細に「登録完了日時」フィールドが表示される | [M] | CORE |
| ADM4 | ステータスセレクトに「設定中」が存在しない（進行中・休止中・卒業のみ） | [M] | CORE |

### 席数上限 UI/UX — 2026-05-21 追加（commit 7d8990a）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| SEAT1 | /admin: 上限未到達時に上限バナーが表示されない（通常状態） | [M] | CORE |
| SEAT2 | /admin: 上限到達時に「利用可能アカウント数」バナーが全幅で表示される | [M] | SCOPE（上限状態のみ） |
| SEAT3 | /admin: 上限到達時に招待ボタンがグレーアウト・クリック不可 | [M] | SCOPE（上限状態のみ） |
| SEAT4 | /admin: 上限未到達時に招待ボタンが通常の青色でクリック可能 | [M] | CORE |
| SEAT5 | /admin: 残り1席時に amber バナーが表示される | [M] | SCOPE |
| SEAT6 | /admin/billing: 「利用可能アカウント数」表記でプログレスバーが表示される | [M] | CORE |
| SEAT7 | /home/register: 上限未到達テナントでフォームが従来どおり表示・送信できる | [M] | CORE |
| SEAT8 | /home/register: 上限到達テナントで「上限に達しているため、担当トレーナーにお問い合わせください。」の2行案内画面が表示される | [M] | SCOPE（上限状態のみ） |
| SEAT9 | GET /api/liff/register: 認証なし → 401 | [A] | CORE |
| SEAT10 | GET /api/liff/register: 偽トークン → 401 | [A] | CORE |
| SEAT11 | GET /api/liff/register: GET チェックが失敗（サーバエラー等）してもフォームが表示される（フォールスルー） | [M] | CORE |

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

### セルフサーブ・オンボーディング（/store/onboarding）— 2026-05-22 追加（commit 5bd2977）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| ONB1 | GET /api/store/onboarding/state: 未認証 → 401 | [A] ✅ | CORE |
| ONB2 | POST /api/store/onboarding/verify-liff: 未認証 → 401 | [A] ✅ | CORE |
| ONB3 | POST /api/store/onboarding/verify-token: 未認証 → 401 | [A] ✅ | CORE |
| ONB4 | POST /api/store/onboarding/build-richmenu: 未認証 → 401 | [A] ✅ | CORE |
| ONB5 | POST /api/store/onboarding/issue-test-token: 未認証 → 401 | [A] ✅ | CORE |
| ONB6 | POST /api/store/onboarding/test-push: 未認証 → 401 | [A] ✅ | CORE |
| ONB7 | POST /api/store/onboarding/state: 未認証（complete:true）→ 401 | [A] ✅ | CORE |
| ONB8 | GET /api/public/tenant-config: tenantId なし → 400 | [A] ✅ | CORE |
| ONB9 | GET /api/public/tenant-config: 存在しない tenantId → 404（CORS ヘッダー付き） | [A] ✅ | CORE |
| ONB10 | OPTIONS /api/public/tenant-config → 204（CORS プリフライト） | [A] ✅ | CORE |
| ONB11 | POST /api/public/onboarding/owner-userid: パラメータなし → 400 | [A] ✅ | CORE |
| ONB12 | POST /api/public/onboarding/owner-userid: 無効トークン → 400 | [A] ✅ | CORE |
| ONB13 | /store/onboarding: 未認証 → /store/login?from=%2Fstore%2Fonboarding にリダイレクト | [A] ✅ | CORE |
| ONB14 | /store/onboarding: 「セットアップ」タブが /store のみ表示（storeOnly: true 制御） | [A] コード確認済み ✅ | CORE |
| ONB15 | /store トップ: onboardingCompletedAt=null → 未完了バナー表示 | [M] | CORE |
| ONB16 | /store トップ: onboardingCompletedAt 設定済み → バナー非表示 | [M] | CORE |
| ONB17 | ウィザード Step 0〜4 の遷移・「戻る」ボタン動作 | [M] | CORE |
| ONB18 | Step 1: LIFF ID 保存 → Step 1 次へボタンが有効化 | [M] | CORE |
| ONB19 | Step 2: リッチメニュー構築ボタン → richMenuId 取得後 Step 2 次へが有効化 | [M] 実 LINE 必要 | CORE |
| ONB20 | Step 4: テストリンク発行 → URL が表示される | [M] | CORE |
| ONB21 | Step 4: テストリンクを LINE で開く → success 画面・ownerLineUserId 登録 | [M] 実 LINE 必要 | CORE |
| ONB22 | Step 4: テスト送信（ownerLineUserId 取得後）→ LINE にメッセージ届く | [M] 実 LINE 必要 | CORE |
| ONB23 | 完了後: /store トップの未完了バナーが消える | [M] | CORE |
| ONB24 | 完了後: 完了画面でリッチメニュー再構築ボタンが動作する | [M] 実 LINE 必要 | SCOPE |
| ONB25 | /home/onboard-test: tenantId・t パラメータなし → エラー画面表示（JS 側） | [M] | CORE |
| ONB26 | /home/onboard-test: 無効トークン → API 400 → エラー画面表示 | [M] | CORE |

### tenantId 付き LIFF 回帰（/home・/home/register）— 2026-05-22 追加（commit 5bd2977）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| TID1 | /home（tenantId なし）→ NEXT_PUBLIC_LIFF_ID でフォールバック initLiff・既存動作継続 | [M] 実機 LINE 必要 | CORE |
| TID2 | /home/register（tenantId なし）→ NEXT_PUBLIC_LIFF_ID でフォールバック・フォーム表示 | [M] 実機 LINE 必要 | CORE |
| TID3 | /home（tenantId 付き・liffId 設定済みテナント）→ テナント固有 liffId で initLiff | [M] 実機 LINE 必要 | SCOPE |
| TID4 | /home（tenantId 付き・liffId 未設定テナント）→ フォールバック initLiff・クラッシュしない | [M] | CORE |
| TID5 | /home/register の 401 リトライ: NEXT_PUBLIC_LIFF_ID で再 init・無限ループしない | [M] | CORE |
| TID6 | sessionStorage への tenantId 保存: ページ遷移後も tenantId が引き継がれる | [M] | SCOPE |

### 課金制御（billingMode）— 2026-05-22 追加（commits fe8c35a/f4ea56c/bcb152f）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| BL1 | GET /api/admin/plans: 認証なし → 401 | [A] | CORE |
| BL2 | POST /api/admin/plans: 認証なし → 401 | [A] | CORE |
| BL3 | PATCH /api/admin/plans/[code]: 認証なし → 401 | [A] | CORE |
| BL4 | POST /api/admin/tenants/[id]/apply-stripe: 認証なし → 401 | [A] | CORE |
| BL5 | PATCH /api/admin/tenants/[id]: billingMode='手動' → Stripe連動モードで seatLimit 送信 → 400 | [A] | CORE |
| BL6 | PATCH /api/admin/tenants/[id]: 不正な billingMode 値 → 400 | [A] | CORE |
| BL7 | POST /api/stripe/checkout: 無制限テナントで呼ぶ → 403 | [A] | CORE |
| BL8 | POST /api/stripe/update-seats: 手動テナントで呼ぶ → 403 | [A] | CORE |
| BL9 | GET /api/admin/plans: master Cookie で呼ぶ → 標準プラン1件含むリスト返却 | [A] | CORE |
| BL10 | POST /api/admin/plans: PoC プラン新規作成 → 201 + plan 返却 | [A] | CORE |
| BL11 | PATCH /api/admin/plans/[code]: 作成済みプラン編集 → 200 | [A] | CORE |
| BL12 | /admin/plans: 標準プランが一覧に表示される（Notion Integration アクセス確認） | [M] | CORE |
| BL13 | /admin/tenants/[id]: 課金モードドロップダウンが表示される | [M] | CORE |
| BL14 | /admin/tenants/[id]: 課金モードを「無制限」に変更・保存 → 保存成功メッセージ | [M] | CORE |
| BL15 | /store/billing（テナント staging）: billingMode=無制限 → 「運営管理プラン」表示・申込みフォームなし | [M] | CORE |
| BL16 | /store/billing（テナント staging）: billingMode=手動・席数設定済み → 「運営管理プラン」+席数表示 | [M] | SCOPE |
| BL17 | /store/billing（テナント staging）: billingMode=Stripe連動 → 従来の自己申込みフォームが表示される | [M] | CORE |
| BL18 | /store/billing（Stripe連動）: 席数選択・月額計算・申込みボタン → Stripe Checkout 画面に到達 | [M] | CORE（回帰） |
| BL19 | webhook: Stripe連動 以外のテナントへのサブスク更新イベント → seatLimit 書き換えなし（コードガード確認） | [A] コード確認で代替可 | SCOPE |

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
| 2026-05-22 | セルフサーブ・オンボーディング Phase 1（ジム経営者向け LINE 連携ウィザード） | 5bd2977 | 条件付き GO（自動検証全通過・ONB1〜ONB13/ONB8〜ONB12・ONB14 コード確認済み。社長手動確認カード発行済み） |
| 2026-05-22 | 本番スモーク: merge c6a39e4（課金制御フル実装・席数UI改修・Notionバグ修正 7コミット） | c6a39e4 | 本番スモーク OK（自動検証全通過）・社長手動確認カード発行済み（SEAT7/REG4/BL12〜BL18） |
| 2026-05-22 | 課金制御フル実装（billingMode 3種・fitmeal-plans DB・webhook ガード・API ガード） | bcb152f | 条件付き GO（社長手動確認 BL12〜BL18 待ち） |
| 2026-05-21 | lib/notion.ts: createTenantCustomerDb スキーマ補完 + listTenantRows マスタキー分離 | acabbaa | GO（自動検証完全通過・社長手動確認不要） |
| 2026-05-21 | 席数上限 UI/UX 改修（用語統一・バナー全幅・招待無効・登録フォームガード） | 7d8990a | 条件付き GO（社長手動確認待ち） |
| 2026-05-21 | オンボツアー吹き出し化・自己登録フォーム・設定中廃止・招待ボタン・登録完了日時 | 3fa0cf4（merge） | 条件付き GO（社長手動確認待ち） |
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
- `/home/onboard` は Next.js App Router の都合で HTTP 200 を返しつつ HTML 内に `NEXT_REDIRECT;replace;/home/register;307` を含む。ブラウザでは /home/register に遷移する。curl でのステータスコード確認は 200 が正常
- `設定中` ステータスは完全廃止。STATUSES / STATUS_OPTIONS から削除済み。管理画面でこの値を持つ顧客がいた場合は要手動更新（DB上は値が残る可能性あり）
- 「ユーザー招待フォームをコピー」ボタンはコピー内容に URL + テンプレ文を含む。コピー先のテキストにURL以外のテキストが入ることを顧客説明時に注意
- `登録完了日時` は `/api/liff/register` 成功時に Notion に書き込まれる。既存顧客はこの日時が null になる（以前の登録方式では保存されなかったため）
- GET `/api/liff/register` のチェックが失敗（ネットワークエラー・500 等）した場合、catch ブロックで無視してフォームが表示される設計。サーバー側 POST でも上限チェックするため二重防止になっている
- POST `/api/liff/register` で 403（席数上限）が来た場合、over-limit フェーズにはならずフォームに「定員に達しているため…」のエラーメッセージが submitError として表示される（GET チェックをすり抜けた場合の最終防波堤として機能）
- **onboardingTokens.ts のインスタンス問題（設計上の既知制約）**: issueToken と consumeToken はメモリ内 Map で管理（globalThis スコープ）。Vercel がマルチインスタンスを起動した場合、token を発行したインスタンスと verify するインスタンスが異なり、consumeToken が null を返す可能性がある。TTL=15分のベストエフォート設計（CHANGELOG に記載あり）。再発行ボタンで回避可能
- **リッチメニュー URL の /register パス**: lineRichMenu.ts の registerUrl は `liff.line.me/{liffId}/register?tenantId=xxx` → LIFF エンドポイント URL `/home` からの相対パスで `/home/register?tenantId=xxx` に展開される。`/home/register` は存在するルートのため正常
- **register 401 リトライ時の liffId**: フォーム送信後の 401 リトライは process.env.NEXT_PUBLIC_LIFF_ID（デフォルト LIFF ID）で再 init する。tenantId 指定ユーザーが 401 になった場合、テナント固有 liffId でなくデフォルト liffId でリトライする。通常はアクセストークン取得後に 401 が発生するケースはほぼないため実害は低いが、マルチテナント本格展開後は要見直し
- **tenant-config のキャッシュ**: s-maxage=300（5分）。テナントの liffId を更新した直後は CDN キャッシュで古い値が返ることがある。本番でテナント設定変更後 5 分は反映に遅れる場合がある
- 招待ボタンの disabled 状態は `seatInfo` が null（billing/info API 失敗）の場合は enabled になる（失敗時はボタンが使えることが優先）
- 席数カウントは「進行中」のみ。休止中・卒業は席数消費しない
- **billingMode=null（未設定）は後方互換で Stripe連動 扱い**。新規テナントは Stripe連動 として扱われる
- **billingMode バリデーション**: 許可値は「無制限」「手動」「Stripe連動」の3種のみ。その他の値は Notion の select に新規オプションが作られるのを防ぐため API が 400 を返す
- **手動モードで seatLimit 未設定（null）**: Admin UI で手動モードを選択すると席数入力フィールドが表示される。未入力で保存した場合、seatLimit=null → getSeatStatus では `seatLimit !== null ? ... : false` なので isOverLimit=false（上限なし扱い）になる。設計書のエッジケースに記載あり
- **Stripe連動モードでの seatLimit 直接編集禁止**: PATCH /api/admin/tenants/[id] で Stripe連動のまま seatLimit を送信すると 400 になる。UI 側も手動モード以外では seatLimit 入力フィールドを表示しない（save() 関数で明示的に除外）
- **fitmeal-plans DB の標準プラン**: Stripe PriceID が空の場合は env の STRIPE_PRICE_PER_USER / STRIPE_PRICE_SUPPORT_FEE にフォールバック（planCode=standard のみ）。PoC/エンタープライズで PriceID 未設定の場合は inline price_data が生成される
- **apply-stripe の Stripe反映セクション**: UI 上は billingMode=Stripe連動 または 未設定（空文字）の場合のみ表示される（無制限・手動では非表示）
