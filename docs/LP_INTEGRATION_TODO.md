# LP 連携 TODO（社長作業 / 別エージェント作業）

関連: `docs/SELFSERVE_SIGNUP_DESIGN.md`（Part A）
詳細手順書: `/home/mwds/fitmeal-lp/SIGNUP_PHASE2_LP_SWAP.md`

## LP 側でやること（本番反映時）

mewodas-liff `staging` ブランチのセルフサーブ申込実装（`/api/public/signup`）を本番に出したあと、
LP（`fitmeal-lp` リポジトリ）側の以下の作業が必要。

### 1. 申込フォームの送信先を新エンドポイントに変更

- 現在: `<form action="/api/apply" method="POST">`（Notion 直書き）
- 変更後: `POST https://app.fitmeal.jp/api/public/signup` へ JSON で送信

フォームフィールドの変更:

| 旧フィールド | 新フィールド | 備考 |
|---|---|---|
| `name` (氏名) | `ownerName` | |
| `email` | `email` | 変更なし |
| `gymName` | `gymName` | 旧フォームに無ければ追加 |
| `headcount` | `headcount` | 旧フォームに無ければ追加（number, 既定5） |
| `phone` | `phone` | 任意 |
| （新規）| `_gotcha` | honeypot。`display:none` の hidden input |

### 2. submit ハンドラの差し替え

レスポンスの `{ url }` を受け取って `window.location.href = url` でリダイレクト（Stripe Checkout）。
従来の `/api/apply` は form の `method="POST"` で直接サーバーへ送っていたが、
新エンドポイントは JSON を受け取り Checkout URL を返すため、fetch + redirect に変える。

具体的な HTML・JS は `fitmeal-lp/SIGNUP_PHASE2_LP_SWAP.md` の「作業手順」参照。

### 3. フォーム文言の変更

| 旧文言 | 新文言 |
|---|---|
| 「30分以内に返信」「3営業日以内」等 | 「お申し込み後すぐにアカウントが発行されます」 |
| 送信ボタン「申し込む」 | 「2週間無料で申し込む（カード登録へ）」 |
| フォーム説明（ない場合） | 「トライアル期間中は¥0、解約自由。」 |

### 4. 旧 `/api/apply`（Notion 直書き）の廃止

切り替え後 1 週間問題がなければ `fitmeal-lp/api/apply.js` を削除またはリネーム。

### 5. 動作確認手順（Stripe テストモード）

事前条件:
- staging に対して STRIPE_PRICE_SUPPORT_FEE / STRIPE_PRICE_PER_USER が設定済み（Stripe テスト用 Price ID）
- staging Stripe webhook (`checkout.session.completed`) が `staging.fitmeal.jp/api/stripe/webhook` を向いている

手順:
1. LP フォームにジム名・名前・メール・顧客数（例: 5）を入力して送信
2. Stripe Checkout（テストモード）に遷移することを確認
3. テストカード `4242 4242 4242 4242`・有効期限 `12/99`・CVC `123` で決済
4. `https://app.fitmeal.jp/signup/welcome?session_id=...` に着地することを確認
5. 数分以内にウェルカムメール（ログインURL・初期パスワード・LINE連携ガイドリンク）が届くことを確認
6. メール記載の `/store/login` でログインできることを確認
7. Stripe ダッシュボードでテスト顧客をキャンセル（トライアルなので課金なし）
8. Notion テナント DB に新テナント行が作成されていることを確認

エラー確認場所:
- Vercel Functions ログ（`app/api/stripe/webhook`・`app/api/public/signup`）
- Stripe ダッシュボード > Webhooks > イベントログ

## 事前チェックリスト（本番切り替え前）

- [ ] mewodas-liff `staging` の `/api/public/signup` が staging Stripe テストモードで動作確認済み
- [ ] `STRIPE_PRICE_SUPPORT_FEE`・`STRIPE_PRICE_PER_USER` が本番 Vercel（fitmeal プロジェクト）に設定済み
- [ ] Stripe 本番 webhook endpoint（`https://app.fitmeal.jp/api/stripe/webhook`）に `checkout.session.completed` が登録済み
- [ ] Notion 「FitMeal プラン」DB の `standard` 行に本番 Stripe Price ID が紐づいている
- [ ] `help.fitmeal.jp/onboarding.html`（LINE 連携ガイド）が公開済み
- [ ] mewodas-liff が main にマージ済み（本番デプロイ済み）
