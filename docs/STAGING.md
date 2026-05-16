# ステージング環境セットアップ手順

本番と完全分離したテスト環境。顧客側変更を本番に出す前に必ずここで検証する。

## アーキテクチャ

| 環境 | ドメイン | LINE公式 | LIFF | Notion DB | Vercel branch |
|---|---|---|---|---|---|
| **本番** | app.fitmeal.jp | メヲダス公式 | 既存 | メヲダステナント | `main` |
| **staging** | staging.fitmeal.jp | 開発用LINE | 新規LIFF | mewodas-staging テナント | `staging` |

---

## Notion 構築済みリソース（私が作成済み）

### 親ページ
- `🧪 FitMeal ステージング環境`
- ID: `362a47a8-738d-8150-9649-fe2b9973204b`
- URL: https://www.notion.so/362a47a8738d81509649fe2b9973204b

### DB ID 一覧
```
顧客DB:     31cbec9f4d6d495cbcf5352b4a102954
食事DB:     5ee5841e440f497987db8df44ad1da15
通知DB:     8f139a303da646089f15ea3219c0d1b8
店舗DB:     5eefac1e61404a38a1b4b93a5a17f489
テンプレDB: deee2127823d4f96bc0fc3516887c5c3
```

### テナントレコード（FitMeal テナント DB）
- tenant_id: `mewodas-staging`
- ページID: `362a47a8-738d-8120-8734-e3507564ba55`

---

## 社長がやる手動作業（一度きり）

### Step 1: Notion Integration を親ページに招待

1. Notion で `🧪 FitMeal ステージング環境` ページを開く
2. 右上「・・・」→「コネクト」→ 本番で使っている Integration を選択
3. 配下のDBに自動でアクセス権が付与される

### Step 2: LINE Developers でステージング用 LIFF アプリ作成

1. https://developers.line.biz/console/ にログイン
2. 既存の **開発用 LINE Channel** を選択
3. 「LIFF」タブ → 「Add」
4. 設定:
   - LIFF app name: `FitMeal Staging`
   - Size: `Full`
   - Endpoint URL: `https://staging.fitmeal.jp/home`
   - Scope: `profile`, `openid`
   - Bot link feature: `On (Aggressive)`
5. 作成 → LIFF ID を控える（後でVercel env に入れる）
6. LINE Channel の「Messaging API」タブから **Channel Access Token (long-lived)** を発行（既にあれば再利用）

### Step 3: お名前.com で DNS 設定

`staging.fitmeal.jp` を Vercel に向ける（DNS 移管前提）:

#### 移管済みの場合（推奨）
何もしなくて良い。Vercel 側でサブドメイン自動配信。

#### 移管前の場合
お名前.com で以下のレコードを追加:
- ホスト: `staging`
- TYPE: `CNAME`
- VALUE: `cname.vercel-dns.com`

### Step 4: Vercel ダッシュボード設定

#### (a) staging ドメインを追加
1. https://vercel.com/mewodas-projects/fitmeal/settings/domains
2. 「Add」→ `staging.fitmeal.jp` 入力
3. 「Edit」→ Git Branch を **`staging`** に変更（mainではない）
4. 「Save」

#### (b) staging ブランチ向け環境変数を設定
https://vercel.com/mewodas-projects/fitmeal/settings/environment-variables

各 env を「Preview」「Branch: staging」スコープで追加:

```
NEXT_PUBLIC_LIFF_ID=<Step2 で控えた staging LIFF ID>
LINE_CHANNEL_ACCESS_TOKEN=<開発用LINE の Channel Token>
NOTION_API_KEY=<本番と同じでOK、Integration が staging DB にもアクセス権ある場合>
# 必要に応じて以下も staging 専用に
GEMINI_API_KEY=<本番と同じでOK or 別キー>
GAS_RECORD_ENDPOINT=<本番と同じでOK or staging 用エンドポイント>
```

**重要**: FitMeal テナントDBで `tenant_id=mewodas-staging` のレコードを Vercel から検索するので、Notion 側でこのテナントレコードを正しく作成しておく必要がある（私が作成済み）。

### Step 5: テナントレコードに LIFF ID と LINE Channel Token を記入

1. Notion で「FitMeal テナント」DB を開く
2. `メヲダス（ステージング）` レコードを編集
3. **LIFF ID** 欄: Step2 で控えた staging LIFF ID
4. **LINE Channel Token** 欄: 開発用LINE の Channel Token
5. 保存

---

## 開発ワークフロー（Claude も社長もこれを守る）

### 顧客側 LIFF の機能を変更する時
```bash
# 1. staging ブランチに移動
git checkout staging
git pull origin staging

# 2. 機能ブランチを切る（任意。直接 staging でもOK）
git checkout -b staging/<feature-name>

# 3. 実装
# ...

# 4. staging に push
git push origin staging
# (または git push origin staging/<feature-name> → PR で staging にマージ)
```

Vercel が `staging` ブランチを自動デプロイ → `staging.fitmeal.jp` で確認。

### 動作確認方法

1. **PC ブラウザでアクセス**: `https://staging.fitmeal.jp/home`
2. **LINE で確認**:
   - 開発用 LINE 公式アカウントを友だち追加
   - そこから staging LIFF URL `https://liff.line.me/<staging-LIFF-ID>/home` をタップ
   - LINE 内ブラウザで LIFF アプリとして起動

### 本番に上げる
```bash
# 動作確認 OK が出てから
git checkout main
git pull origin main

# staging からマージ用 PR を作成
git checkout staging
gh pr create --base main --head staging --title "Merge staging to main"

# CI build 通過後、社長承認でマージ
gh pr merge --merge
```

---

## トラブルシューティング

### staging.fitmeal.jp に繋がらない
- Vercel ダッシュボードで `staging.fitmeal.jp` ドメインの状態を確認
- 「Valid Configuration」になっていない → DNS 浸透待ち or CNAME 設定確認

### staging で LIFF が起動しない
- staging LIFF アプリの Endpoint URL が `https://staging.fitmeal.jp/home` か確認
- LINE Channel の Web app integration が ON になっているか

### staging で本番データが見える / 編集される
- Vercel env で `NOTION_*_DB_ID` が staging のID になっているか確認
- テナントが `mewodas-staging` で識別されているか確認
- 万一本番DBにテスト書込してしまったら、Notion のページ単位で削除可能

---

## チェックリスト（セットアップ完了の確認）

- [ ] Notion Integration が `🧪 FitMeal ステージング環境` 親ページに招待された
- [ ] LINE Developers でステージング用 LIFF アプリが作成された（Endpoint URL = staging.fitmeal.jp/home）
- [ ] お名前.com or Vercel DNS で `staging.fitmeal.jp` が Vercel を向いている
- [ ] Vercel ダッシュボードで staging.fitmeal.jp ドメインが staging ブランチに紐付いた
- [ ] Vercel env (Preview/staging branch) に NEXT_PUBLIC_LIFF_ID と LINE_CHANNEL_ACCESS_TOKEN が staging 用の値で入っている
- [ ] FitMeal テナントDB の `メヲダス（ステージング）` レコードに LIFF ID + Channel Token が記入された
- [ ] `https://staging.fitmeal.jp/home` にアクセスして画面が表示される
- [ ] 開発用 LINE 公式から staging LIFF を起動できる
