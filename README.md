# メヲダス 食事管理 LIFF

LINE Front-end Framework (LIFF) を使った食事記録アプリ。リッチメニューから起動して、写真+食事区分+メモを1画面で記録できる。

## 構成

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **@line/liff** SDK
- バックエンド：既存のGAS（食事管理システム）にPOST
- ホスティング：Vercel

## ローカル開発

```bash
cp .env.example .env.local
# .env.local を編集して LIFF ID と GAS_RECORD_ENDPOINT を設定
npm install
npm run dev
```

## 環境変数

| 名前 | 用途 |
|---|---|
| `NEXT_PUBLIC_LIFF_ID` | LIFFアプリのID（LINE Developer Consoleで取得） |
| `GAS_RECORD_ENDPOINT` | GAS Web AppのURL |

## デプロイ

GitHubにpush後、Vercelで自動デプロイ。

1. Vercelダッシュボードでこのリポジトリをimport
2. 環境変数を設定
3. 自動でビルド・デプロイされる

## LIFF設定

LINE Developer Console の「LIFF」タブで：

- エンドポイントURL：Vercelの本番URL（例：`https://meodas-liff.vercel.app/record`）
- サイズ：Full
- Scope：`profile`（必須）、`openid`（推奨）

## ファイル構成

```
app/
  page.tsx          # / → /record にリダイレクト
  layout.tsx        # ルートレイアウト
  record/page.tsx   # 食事記録フォーム（メイン画面）
  api/record/route.ts # POSTを受けてGASに転送するAPI
lib/
  liff.ts           # LIFF SDK初期化ヘルパー
```
