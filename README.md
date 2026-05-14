# FitMeal

LINE LIFF を使った食事・体重・運動の記録アプリ。写真+メモから AI が PFC を自動算出。

## 構成

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **@line/liff** SDK
- **Notion** をデータベースとして使用
- **GAS** を LINE Webhook の受け口として使用
- ホスティング：Vercel

## 環境

| 環境 | デプロイブランチ | URL |
|--|--|--|
| ステージング | `main` | （Vercel `mewodas-liff` プロジェクト） |
| 本番 | `release` | （Vercel `fitmeal` プロジェクト） |

詳細セットアップ手順は [`docs/staging-prod-setup.md`](docs/staging-prod-setup.md) を参照。

## ローカル開発

```bash
cp .env.example .env.local
# .env.local を編集
npm install
npm run dev
```

## 主要環境変数

| 名前 | 用途 |
|---|---|
| `NEXT_PUBLIC_LIFF_ID` | LIFFアプリのID |
| `NOTION_API_KEY` | Notion API キー |
| `NOTION_CUSTOMER_DB_ID` | 顧客DB |
| `NOTION_FOOD_DB_ID` | 食事記録DB |
| `NOTION_NOTIFICATIONS_DB_ID` | 通知DB |
| `GAS_RECORD_ENDPOINT` | GAS Web App URL |
| `GEMINI_API_KEY` | Gemini API キー（写真解析・AIチャット） |

## デプロイ

GitHubに push 後、Vercel が自動デプロイ。`main` → ステージング、`release` → 本番。

## ディレクトリ構成

```
app/
  home/             # ホーム画面
  record/           # 食事記録
  history/          # 履歴カレンダー
  weekly/           # 週次レポート
  meal-detail/      # 食事区分ごとの詳細
  notifications/    # お知らせ一覧
  admin/            # トレーナー管理画面
  api/              # API ルート
components/         # UI コンポーネント
lib/                # 共通ロジック（notion/gemini/cache/tenant等）
docs/               # ドキュメント
```
