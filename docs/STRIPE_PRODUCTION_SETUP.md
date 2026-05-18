# Stripe 本番設定手順書

FitMeal SaaS 新プラン構造（2026-05-19 リリース）の本番環境設定手順。
社長（mwds.bmc@gmail.com）が Stripe Dashboard で実施する作業を記載する。

---

## 1. 本番 API キーの取得

1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. 右上のトグルを **本番モード（Live mode）** に切り替える
3. 「開発者」→「APIキー」を開く
4. 以下をコピーして控える：
   - **公開可能キー**: `pk_live_...`
   - **シークレットキー**: `sk_live_...`（「シークレットキーを表示」を押す）

---

## 2. 本番 Product / Price の作成

Stripe Dashboard 本番モードで以下4つの Product / Price を作成する。

### 共通手順

1. 「商品カタログ」→「商品を追加」
2. 商品名・価格を入力（通貨: JPY、請求期間: 月次）
3. 作成後に Price ID（`price_live_...`）を控える

### 作成する4つの Price

| 商品名 | 単価 | 補足 |
|---|---|---|
| FitMeal サポート費 | ¥5,000/月 | quantity=1 固定 |
| FitMeal Starter per-user（3〜20名） | ¥2,500/人/月 | quantity=席数 |
| FitMeal Growth per-user（21〜50名） | ¥2,000/人/月 | quantity=席数 |
| FitMeal Scale per-user（51名+） | ¥1,500/人/月 | quantity=席数 |

---

## 3. 本番 Webhook エンドポイントの登録

1. 「開発者」→「Webhook」→「エンドポイントを追加」
2. エンドポイント URL: `https://app.fitmeal.jp/api/stripe/webhook`
3. リッスンするイベントを選択（以下4種）：
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. 「エンドポイントを追加」をクリック
5. 作成後、「署名シークレット」（`whsec_...`）を控える

---

## 4. Customer Portal の本番設定

1. Stripe Dashboard → 「設定」→「Customer portal」
2. 以下を有効化：
   - 支払い方法の更新
   - サブスクリプションのキャンセル
3. 「ビジネス情報」→「ホームページのURL」: `https://app.fitmeal.jp`
4. 「戻り先 URL（Return URL）」: `https://app.fitmeal.jp/store/billing`
5. 「保存」をクリック

---

## 5. Vercel 環境変数の更新（Production のみ）

Vercel Dashboard → プロジェクト「mewodas-liff」→ Settings → Environment Variables で **Production 環境** に以下を設定する。

| 変数名 | 値 |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...`（手順1で取得） |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`（手順3で取得） |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...`（手順1で取得） |
| `STRIPE_PRICE_SUPPORT_FEE` | サポート費の Price ID（手順2で取得） |
| `STRIPE_PRICE_STARTER_PER_USER` | Starter per-user の Price ID（手順2で取得） |
| `STRIPE_PRICE_GROWTH_PER_USER` | Growth per-user の Price ID（手順2で取得） |
| `STRIPE_PRICE_SCALE_PER_USER` | Scale per-user の Price ID（手順2で取得） |

設定後、Vercel で再デプロイ（「Redeploy」ボタン）を実行する。

---

## 6. 旧契約（テスト）の移行

mewodas テナントの旧 Stripe 契約（旧プラン: 5-10名¥3,000 等）が残っている場合：

1. Stripe Dashboard（**本番モード**）で当該 Customer のサブスクリプションを手動キャンセル
2. Customer Portal または `/store/billing` から新プランで再契約
3. Webhook で Notion テナント DB に `契約席数` と `プラン種別` が書き込まれることを確認

---

## 7. 動作確認チェックリスト

- [ ] `/store/billing` を開き「未契約」状態でプラン比較カードが表示される
- [ ] 席数=5 で「カード登録してプラン開始」→ Stripe Checkout が本番モードで開く
- [ ] 本番カード（実際のカード番号）で決済完了
- [ ] Webhook 受信後、Notion テナント DB に `契約席数=5, プラン種別=Starter` が入る
- [ ] `/store/billing` に「現在の契約: Starter 5席」が表示される
- [ ] `/admin` で6人目を追加しようとすると「席数上限」エラーになる
- [ ] 「席数を変更」で10名に増枠 → Webhook で `契約席数=10` に更新
