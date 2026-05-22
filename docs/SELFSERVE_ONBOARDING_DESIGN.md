# セルフサーブ・オンボーディング Phase 1 設計書

作成日: 2026-05-22
対象ブランチ: `staging`
関連: `docs/SELFSERVE_SIGNUP_DESIGN.md`（Part A 申込フロー、別設計）

---

## 概要

新規テナント（ジム経営者）が `/store` ログイン後、5ステップのウィザードを自力で完走し、LINE 連携・リッチメニュー・動作確認まで完了できる仕組み。顧客の手作業は「LINE Developers Console での3操作」に圧縮。

---

## Phase 1 スコープ

### A. テナント別 LIFF のランタイム解決

- `GET /api/public/tenant-config?tenantId=xxx` — 認証不要・CORS 許可・s-maxage キャッシュ
  - レスポンス: `{ liffId, gymName, brandColor, logoUrl, officialLineUrl }`
  - `lib/tenantResolver.ts` の `getTenantByIdAsync()` 経由で Notion から取得
- 顧客側 LIFF ページ（`/home`, `/home/register`, `/home/onboard-test`）
  - URL `?tenantId=` を読む → tenant-config fetch → 取得した liffId で `liff.init`
  - `?tenantId=` 無し or 取得失敗 → `NEXT_PUBLIC_LIFF_ID` にフォールバック
  - 解決した tenantId を `sessionStorage['fitmeal_tenant_id']` に保存
- `lib/liff.ts` の `initLiff(overrideLiffId?: string)` — 明示 liffId を受け取れるよう後方互換拡張

### B. リッチメニュー自動構築 `lib/lineRichMenu.ts`（新規）

- `createRichMenu(channelToken, opts)`: 作成 → 画像アップロード → 既定設定。richMenuId を返す。
  - opts: `{ liffId, tenantId, gymName, buttonLabels? }`
  - タップ領域:
    - 左: 「アプリを開く」→ `https://liff.line.me/{liffId}?tenantId={tenantId}`
    - 右: 「新規登録」→ `https://liff.line.me/{liffId}/register?tenantId={tenantId}`
- `deleteRichMenu(channelToken, richMenuId)`: 冪等
- テンプレ画像: `public/richmenu-default.png`（2500×1686）
- 冪等: 保存済み richMenuId があれば先に削除して作り直す

LINE API エンドポイント:
- `POST https://api.line.me/v2/bot/richmenu` — 作成
- `POST https://api-data.line.me/v2/bot/richmenu/{id}/content` — 画像アップロード
- `POST https://api.line.me/v2/bot/user/all/richmenu/{id}` — 既定設定

### C. オンボーディング API `/api/store/onboarding/` 配下

認証: 既存 `withAdminTenant` ラッパー（store セッション Cookie）

- `GET/POST /state`
  - GET: `{ step, liffId, channelTokenVerified, richMenuId, ownerLineUserId, onboardingCompletedAt }`
  - POST `{ step }`: onboardingStep 更新
- `POST /verify-token` `{ channelToken }`
  - `GET https://api.line.me/v2/bot/info` 呼び出し
  - レスポンス: `{ ok, botName, basicId, pictureUrl, officialLineUrl }`
  - 成功時: channelToken + officialLineUrl をテナント行に保存
- `POST /verify-liff` `{ liffId }`
  - 形式検証: `^\d{10}-\w+$`
  - 成功時: liffId をテナント行に保存
- `POST /build-richmenu` `{ buttonLabels? }`
  - 保存済み channelToken + liffId で `lib/lineRichMenu.createRichMenu` 呼び出し
  - richMenuId をテナント行に保存、キャッシュ無効化
- `POST /test-push`
  - 保存済み channelToken + ownerLineUserId でテストメッセージ push
- `POST /issue-test-token`
  - 一時トークン（crypto.randomUUID）を生成、TTL 15分で KV（メモリ or グローバル Map）に保存
  - レスポンス: `{ token, testUrl: "https://liff.line.me/{liffId}/home/onboard-test?tenantId=xxx&t=token" }`

公開 API（認証不要）:
- `POST /api/public/onboarding/owner-userid` `{ tenantId, token, userId }`
  - トークン検証（TTL・存在確認）
  - ownerLineUserId を Notion テナント行に保存
  - キャッシュ無効化

### D. ウィザード UI `app/store/onboarding/page.tsx`

**ステップ一覧**

| Step | タイトル | 内容 |
|------|----------|------|
| 0 | はじめに | 所要時間・用意するもの案内 |
| 1 | LINE連携キー | LIFF ID + Channel Token の入力・検証 |
| 2 | リッチメニュー | 自動構築ボタン + 完了プレビュー + OA Manager 利用禁止警告 |
| 3 | ブランド設定 | 店舗名・テーマカラー確認・修正 |
| 4 | 動作テスト | テストリンク発行 → userId 取得 → test-push → 完了 |

中断再開: `onboardingStep` で復元。

**ステップ 1 の強調警告**:
「必ず公式アカウントと同じプロバイダーで作成してください。別プロバイダーだとテストが失敗します。」

**ステップ 2 の警告**:
「リッチメニューは LINE 公式アカウントマネージャーで作成・編集しないでください。FitMeal のメニューが上書き・無効化され、お客様がアプリを開けなくなります。変更はこの画面から行ってください。」

**完了後**:
- onboardingCompletedAt を記録
- `/store` トップで未完了なら目立つバナー＋ウィザード誘導

### E. リッチメニュー再編集（オンボ後も使える）

`app/store/onboarding/page.tsx` の完了後 UI に「再構築」ボタン + ボタンラベル編集。

### F. Notion テナント DB スキーマ拡張

追加列（両 DB: 本番・staging）:

| 列名 | 型 | 用途 |
|------|----|------|
| `onboardingStep` | number | 現在のステップ（0〜4、完了=5） |
| `onboardingCompletedAt` | date | 完了日時 |
| `richMenuId` | rich_text | LINE リッチメニュー ID |
| `ownerLineUserId` | rich_text | オーナーの LINE User ID |

---

## スコープ外（今回やらない）

- LP→Stripe self-serve 申込（`docs/SELFSERVE_SIGNUP_DESIGN.md` Part A）
- ブランド反映のリッチメニュー画像自動生成（テンプレ1種固定）

---

## 既定判断・設計メモ

- `initLiff` の初期化済みフラグはモジュールスコープのため、異なる liffId での再初期化が必要な場合は `initialized = false` にリセットしてから呼び出す
- 一時トークン（オーナー userId 取得）はサーバーメモリ（Map）で TTL 管理。Vercel 関数は複数インスタンスになりうるが、15分 TTL のベストエフォートで十分
- リッチメニュー画像は静的 PNG を fetch してアップロード。`/public/richmenu-default.png` が存在しない場合は SVG テキストを画像生成するフォールバック
- `updateTenantRow` に新規フィールド追加時は Notion 列名を完全一致で管理
- store 認証の既存パターン（`withAdminTenant`）をそのまま踏襲
