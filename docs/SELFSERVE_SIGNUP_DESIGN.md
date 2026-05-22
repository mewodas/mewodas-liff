# FitMeal セルフサーブ申込フロー 設計書

**承認日**: 2026-05-22
**ステータス**: 設計承認済み・Phase 1 実装着手

## 目的

ジム経営者が LP（fitmeal.jp）から申し込み → Stripe でカード登録（2週間トライアル）→
FitMeal アカウントが**自動プロビジョニングされ、人手・待ち時間ゼロで利用開始**できるようにする。

### 承認済みデフォルト
- 申込時の顧客数 = **数値入力**（概算可・既定5）。初期席数になり、以降はアクティブ顧客数に自動追従
- LINE連携 = ジム自身の**ガイド付き手動セットアップ（約15分）**。LINE社にAPIが無く自動化不可

## 全体フロー

```
LP「2週間無料で申し込む」（ジム名・お名前・メール・顧客数・電話[任意]）
   ▼
POST app.fitmeal.jp/api/public/signup  → Stripe Checkout Session 生成 → URL を返す
   ▼
Stripe Checkout（ジムがカード入力／トライアル中は¥0）
   ▼
Stripe webhook  checkout.session.completed（selfServe=true を検知）
   ▼
provisionTenant()：Notion 3DB作成・テナント行・店舗・初期PW発行・ウェルカムメール送信
   ▼
ジムは即 /store にログイン → 管理機能が使える
   ▼（残る唯一の手動・ガイド付き約15分）
ジムが自分の LINE公式アカウント＋LIFF を設定 → /store で LIFF ID 入力
```

FitMeal 側の人手・待ち時間はゼロ。

## Phase 1 スコープ

**含む**：公開申込エンドポイント／Stripe Checkout／webhook 拡張によるテナント自動発行／
プロビジョニング共有関数化／ウェルカムメール／welcome 着地ページ／LP 差し替え／
/store の LIFF ID 入力UI＋オンボーディングチェックリスト。

**含まない（Phase 2 以降）**：LINE連携の自動化（LINE社にAPI無し・不可）／
「LINEなしでも会員が使える」化（LINE任意化の大改修）／マルチLINEチャンネル対応。

## コンポーネント別仕様

### 1. LP（fitmeal-lp/index.html）
- 申込フォーム項目：ジム名・お名前・メール（必須）／顧客数（number, 概算可, 既定5）／電話（任意）
- 送信先：`POST https://app.fitmeal.jp/api/public/signup`（CORS で fitmeal.jp を許可）
- レスポンスの Checkout URL へ `location.href` でリダイレクト
- 既存 `api/apply.js`（Notion 直書き）は廃止
- フォーム文言：「30分以内に返信」→「お申し込み後すぐにアカウントが発行されます」系に変更

### 2. 公開エンドポイント `/api/public/signup`（mewodas-liff・新規）
- 認証なし。honeypot（`_gotcha`）＋レート制限（IP単位）
- 入力検証（ジム名・氏名・email 必須、顧客数は正の整数）
- Stripe Checkout Session 作成：
  - `mode: subscription`
  - `subscription_data.trial_period_days: 14`
  - `payment_method_collection: 'always'`（トライアルでも必ずカード取得）
  - `line_items`：標準プラン（`fitmeal-plans` の `standard`）= サポート費 price + per-user price × 顧客数
  - `customer_email`：入力メール
  - `metadata` と `subscription_data.metadata` の両方に `{ selfServe:'true', gymName, ownerName, headcount, phone }`
  - `success_url`：`/signup/welcome?session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url`：`https://fitmeal.jp/#cta`
- Checkout Session URL を返す
- 申込ログ：Notion「FitMeal リード（LP申込）」DB（`e8f98d5e9df64c3c9a07e1c4a6982c85`）に「申込（未決済）」で1行作成（離脱可視化用・任意）

### 3. webhook 拡張 `/api/stripe/webhook`
- `checkout.session.completed` ハンドラ：
  - `metadata.selfServe === 'true'` で分岐
  - **冪等性**：既に当該 stripeCustomerId / checkout session で発行済みテナントがあれば skip
  - `provisionTenant()` を呼ぶ
  - 作成テナントに `billingMode='Stripe連動'` を明示、stripeCustomerId/subscriptionId を紐付け
  - 既存の `handleSubscriptionUpdate` で seatLimit 等を同期
- 非 self-serve（既存 tenantId 指定）の挙動は不変

### 4. プロビジョニング共有関数 `provisionTenant()`（lib に抽出）
- 現行 `/api/admin/tenants` POST のロジックを共有関数化：
  Notion 顧客DB・食事DB・体重DB 作成／テナント行作成／デフォルト店舗作成／
  初期パスワード生成・scrypt ハッシュ保存／ウェルカムメール送信
- **冪等・部分失敗時に再実行安全**（既存リソースは再利用、途中再開可能）
- admin の POST もこの共有関数経由に置換（ロジック重複排除）

### 5. ウェルカムメール
- 宛先：オーナーメール
- 内容：`/store` ログインURL・ログインメール・初期パスワード・「次の15分でLINE連携」ガイドリンク（help.fitmeal.jp の該当記事）・トライアル終了日

### 6. `/signup/welcome` ページ（mewodas-liff・新規・公開）
- Checkout 完了後の着地。「受付完了・数分以内にメールが届きます」を表示
- プロビジョニングが非同期で進む旨を案内

### 7. /store オンボーディング
- 初回ログイン時にオンボーディング チェックリスト表示
- LIFF ID 入力UI（ジム自身が入力）
- LINE OA／LIFF／リッチメニュー設定ガイドへのリンク

## 冪等性・例外処理
- webhook 二重発火：stripeCustomerId / session_id で重複検知し skip
- プロビジョニング途中失敗：Stripe が webhook を自動リトライ。`provisionTenant` は再実行安全に。一定回数失敗で管理者へアラート（Slack/メール）
- スパム：honeypot＋レート制限。実プロビジョニングはカード入力後のみ＝実害小

## 課金・価格
- 標準プラン（`fitmeal-plans` の `standard`）。サポート費¥5,000＋per-user 段階制
- トライアル中（14日）は¥0。期間中解約で課金ゼロ
- 顧客数は初期席数。以降アクティブ顧客数に自動追従（既存席数管理）

## セキュリティ
- 公開エンドポイントは CORS を fitmeal.jp に限定／レート制限／honeypot
- Stripe webhook 署名検証（既存踏襲）
- 初期パスワードはメール送信のみ・scrypt ハッシュ保存（既存踏襲）

## リリース手順
1. staging で Stripe **テストモード**にて全フロー検証
2. fitmeal-qa による QA
3. 本番反映（Stripe 本番モード）
- 本番反映前に help.fitmeal.jp の「LINE連携ガイド」記事が公開済みであること

## Phase 2（将来・別途）
- 「LINEなしでも会員が使える」化（LINE設定の任意化）
- LINE連携のさらなる省力化／マルチLINEチャンネル対応
