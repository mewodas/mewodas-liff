# ステージング / 本番環境セットアップ手順書

最終更新: 2026-05-14

## 全体像

| 環境 | URL | LIFF ID | Vercelプロジェクト | デプロイブランチ | Notion DBs |
|--|--|--|--|--|--|
| **開発（ステージング）** | 現状継続 | 開発用（既存） | `mewodas-liff`（既存） | `main` | ステージング用（新規作成済み） |
| **本番** | 新規発行 | 本番用（新規） | `mewodas-liff-prod`（新規） | `release` | 既存DB（実顧客データ） |

## Notion DB IDs（記録）

### 本番用DB（実顧客データ。Vercel `mewodas-liff-prod` から接続）
| DB名 | DB ID |
|--|--|
| 顧客データベース｜メヲダス五反田店 | `7324e5a5-90ad-46a5-95f0-c6fc58c34816` |
| 食事記録DB｜メヲダス | `8719d5ab-2307-4ea5-bf6e-77fde352db86` |
| 通知DB｜食事管理LIFF（新規作成済み） | `dbce4fc2-e58d-4a4b-933d-512f92e3a0de` |

### ステージング用DB（空・テスト用。Vercel `mewodas-liff` から接続）
| DB名 | DB ID |
|--|--|
| 顧客DB｜ステージング | `1b857ddf-6aea-494c-b814-f506628120e3` |
| 食事記録DB｜ステージング | `cb2fac0e-bb0a-4721-865f-ed8e765e4dbb` |
| 通知DB｜ステージング | `0df6aa09-3ac4-4b8a-bbcc-b5bc9bf44bc2` |

親ページ: 🧪 ステージング環境｜食事管理LIFF開発用  
URL: https://www.notion.so/360a47a8738d81c281d0ee2b6e34578d

---

## 社長作業チェックリスト

### A. LINE Developer Console 作業

- [ ] 本番LIFFアプリを新規発行
  - 本番LINE公式アカウント（既存）の Messaging API チャネル配下にLIFFを追加
  - エンドポイントURL: （新Vercel `mewodas-liff-prod` のURL）
  - サイズ: Full
  - 取得したLIFF IDをメモ → env var `NEXT_PUBLIC_LIFF_ID` に使用

- [ ] 本番LINEチャネルのWebhook設定
  - GAS WebApp URL を本番LINEの Webhook URL に設定
  - （後述の本番GAS作成後）

### B. Vercel 作業

#### B-1. 本番プロジェクト `mewodas-liff-prod` 新規作成

- [ ] 既存GitHubリポジトリ（`mwds/mewodas-liff`）から新規Import
- [ ] **Production Branch を `release` に設定**（重要）
- [ ] 環境変数を以下のように設定:

```
# LIFF（本番）
NEXT_PUBLIC_LIFF_ID=<本番LIFF ID>
NEXT_PUBLIC_LIFF_URL=https://liff.line.me/<本番LIFF ID>

# Notion（既存DB = 実顧客データ）
NOTION_API_KEY=<既存と同じ>
NOTION_CUSTOMER_DB_ID=7324e5a590ad46a595f0c6fc58c34816
NOTION_FOOD_DB_ID=8719d5ab23074ea5bf6e77fde352db86
NOTION_NOTIFICATIONS_DB_ID=dbce4fc2e58d4a4b933d512f92e3a0de

# LINE（本番）
LINE_CHANNEL_ACCESS_TOKEN=<本番LINEチャネルのトークン>

# GAS（本番）
GAS_RECORD_ENDPOINT=<本番GAS WebApp URL>

# Gemini / Drive（既存と同じで可）
GEMINI_API_KEY=<既存>
DRIVE_PARENT_FOLDER_ID=<既存 or 本番用に新規作成>

# Admin（本番）
ADMIN_EMAIL=<本番管理アカウント>
ADMIN_PASSWORD_HASH=<本番管理パスワード>
ADMIN_SESSION_SECRET=<新規生成>
```

#### B-2. 既存プロジェクト `mewodas-liff`（→ ステージング化）の env vars 更新

- [ ] 環境変数を以下に**書き換え**:

```
# Notion を ステージング用DB に切替
NOTION_CUSTOMER_DB_ID=1b857ddf6aea494cb814f506628120e3
NOTION_FOOD_DB_ID=cb2fac0ebb0a4721865fed8e765e4dbb
NOTION_NOTIFICATIONS_DB_ID=0df6aa093ac44b8abbccb5bc9bf44bc2

# 他はそのまま（LIFF ID/LINE token/GAS endpoint等は開発用のまま）
```

### C. GAS 作業

- [ ] 本番GASプロジェクトを新規作成（既存GASを clasp clone でコピー）
  - ディレクトリ: `04_CTO_技術システム/GAS/食事管理システム_本番/`
  - 内部のNotion DB IDs（コード冒頭の `CONFIG`）を本番DB IDsに設定
- [ ] WebApp としてデプロイし、URLを取得
- [ ] 本番LINEチャネルの Webhook URL に上記URLを設定
- [ ] `setupTriggers()` を実行してトリガー登録

### D. ステージングのテストアカウント作成

ステージングVercelに環境変数を反映後:
1. 社長（または別アカウント）が**開発用LINE公式**を友だち追加
2. 開発用GASが「電話番号送信を依頼」 → 返信
3. ステージング顧客DBに自分のレコードが作成される（このとき LINEユーザーID が記録される）
4. 食事管理ステータスを「進行中」に設定 → LIFFで動作確認可能

### E. 顧客への切替案内

本番環境動作確認後、既存顧客（4名）に以下を順次案内:
1. 既存（開発用）LINE経由で「新しいLINE公式アカウントに移行します」とアナウンス
2. 本番LINE公式のQRコード/友だち追加URLを送付
3. 顧客が本番LINEを友だち追加 → 電話番号送信 → 自動連携完了
4. リッチメニューから本番LIFFが開けることを確認

---

## 日常運用フロー（セットアップ完了後）

```
普段の開発:
  └─ main ブランチに push
      └─ Vercel `mewodas-liff` がauto-deploy → ステージングで動作確認

リリース:
  └─ git checkout release
      └─ git merge main
          └─ git push
              └─ Vercel `mewodas-liff-prod` がauto-deploy → 顧客に反映
```

緊急ロールバック:
```
git revert <bad-commit> または
git checkout release && git reset --hard <safe-commit> && git push --force
（Vercel上で前バージョンへロールバックも可能）
```

---

## 既知の制限・注意点

- **LINE User ID は チャネルごとに別物**: 開発LINEと本番LINEで同じ人でも別のIDが発行される。既存顧客の `LINEユーザーID` 値は本番LIFF切替時に再連携が必要（電話番号送信フロー経由で自動更新される）
- **Google Drive フォルダ**: 食事写真の保存先。本番では別フォルダにすると衛生的（任意）
- **Notion API キー**: 同じワークスペースなら共通でOK。データソースアクセスは各DBの「コネクションを追加」で許可必要
- **顧客DBスキーマ**: ステージング用 顧客DB は本番スキーマと**完全一致ではない**（一部のSELECT選択肢を簡略化）。LIFF/admin で使われる主要プロパティは全て揃っているが、不足プロパティがあれば追加可能
