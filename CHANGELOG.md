# CHANGELOG

## 2026-05-28 – change(profile): 1日の栄養目標カードをホーム栄養サマリと同じ素の表記に揃える
- change(profile): 「1日の栄養目標」セクションをホーム /home の `NutritionSummaryCard` と同じトーン＆マナーに統一。オレンジヒーロー・炎アイコン・色枠カードは廃止。kcal はプレーンな大きい数字、PFC 3項目はラベル＋数字のシンプル列、最下部に PFC バランス積み上げ帯のみ残す
- PfcCard コンポーネントは廃止（用途消失）

## 2026-05-28 – change(profile): 1日の栄養目標カードのUIリッチ化
- change(profile): 「1日の栄養目標」セクションを刷新。kcal をオレンジグラデーションのヒーローカード（炎アイコン付き）に格上げ、PFC は abbr バッジ＋g 値＋カロリー比率% を表示する3カードに、最下部に PFC バランス（カロリー比率の積み上げ帯＋凡例）を追加
- 既存 StatCard は 体重目標 セクションで継続利用、栄養目標専用に NutritionGoalCard / PfcCard コンポーネントを新規分離

## 2026-05-28 – fix(badges): /badges で 401 になる不具合修正 + プロフィール絵文字削除
- fix(badges): `/badges` 画面で `/api/today` を生 `fetch()` で呼んでいたため Authorization ヘッダが付かず常に 401。`apiFetch` 経由に修正（LIFF IDトークンが正しく付与される）。`lineUserId` クエリパラメータは不要（withLiffTenant が verified userId を解決するため削除）
- change(profile): 「目標達成日」「1日の栄養目標」セクションヘッダの絵文字（lucide-react Calendar / Target アイコン）を削除。タイトル文字のみに

## 2026-05-28 – feat(liff): 12項目改善のフィードバック反映（追加調整）
- change(record/confirm): テキスト記録のメモ形式を食品DB/マイメニューと同じ `${name} ｜ テキスト記録から登録` 形式に統一。per-item でバッジ付与（一覧で全item に「テキスト記録から登録」表示）
- change(profile): 目標サマリを廃止し、/goals の全コンテンツ（体重目標カード / 目標達成日 + 残日数バッジ / 1日の栄養目標4カード / プラン・活動レベル）をプロフィール画面にインライン化。/goals への詳細リンクも削除
- change(menu): 設定カテゴリから「目標設定」を削除（プロフィールに統合済み）
- change(menu): お知らせ専用セクションを廃止し、設定カテゴリの「プロフィール」直下に移動
- change(menu): 「体重推移・予測」を AI機能 カテゴリから 記録・分析 カテゴリへ移動
- change(weekly): 中央ボタンの表示を文脈依存に変更。offset===0 なら「今週」、過去週なら「N週間前 / 日付レンジ」を1ボタン内に集約。ボタン直下の独立した日付行は削除
- 影響範囲: 顧客側 LIFF（/profile /menu /weekly + /api/record/confirm）
- 経緯: 2026-05-27 staging 確認後の社長フィードバック反映

## 2026-05-27 – feat(liff): 顧客LIFF 12項目改善（要望対応）
- feat(chat): AI食事相談プロンプトに「マークダウン禁止（特に `**太字**`）」を追加 + クライアント側で応答から `**` を strip（lib/gemini.ts、app/chat/page.tsx）
- change(record): 食事記録画面の朝食/昼食/夕食/間食 セグメント上部に出ていた「現在選択中の食事タイプ」緑ピル表示を削除（app/record/page.tsx）
- feat(record): 写真選択 → 圧縮中のローディングオーバーレイ追加。既存の解析中/保存中オーバーレイと共通の見た目で「写真を読み込み中」フェーズを表示（app/record/page.tsx）
- change(record): 解析結果確認画面の「AIに補正させる」セクションラベル左の絵文字（🔄）と「補正して再解析する」ボタン内の絵文字を削除。同セクションの枠を太く（border-2 border-emerald-300）、ボタンを primary CTA 化（bg-emerald-500 + text-white + shadow-md）して再解析動線を強調（app/record/page.tsx）
- change(prediction): 体重推移・予測画面の「AIアドバイス」セクションを削除。`Lightbulb` import 削除、`recommendations` の表示ブロック除去（app/prediction/page.tsx）
- feat(record): 「記録しました」画面に「内訳（N品）」セクションを追加。各食材の名前・PFC・kcal を per-item で表示（写真解析・テキスト解析どちらでも内訳が見える）（app/record/page.tsx）
- feat(record): テキストのみで記録した食事に「テキスト記録」マーカーを付与。クライアントから `source: 'text_input'` を送信、サーバで supplementText 先頭に `[テキスト記録]` を挿入（app/record/page.tsx、app/api/record/confirm/route.ts）
- feat(profile): プロフィール画面に目標サマリ（体重目標・1日の栄養目標・プラン・活動量）を追加。詳細は /goals へのリンクで誘導（app/profile/page.tsx）
- feat(announcements): 運営からの全テナント共通お知らせを新規 Notion DB（`NOTION_ANNOUNCEMENTS_DB_ID`）から取得する仕組みを追加。`lib/announcements.ts`、`/api/announcements`、`/app/announcements/page.tsx`（旧：notifications 再エクスポート → 新：独立ページ）、`/app/menu/page.tsx` に「お知らせ」セクション追加
- fix(weekly): 週次レポートの緑ヘッダから日付サブタイトルを撤去。代わりに「前週／今週／翌週」ボタングループ直下に選択中の週の日付レンジを表示。`今週` 以外でも常に3ボタン表示（grid-cols-3）、`今週` のアクティブ状態は offset===0 のときのみ、`翌週` は offset>=0 で disabled。これにより「前週を押しても表示が今週のまま」のバグ修正（app/weekly/page.tsx）
- 影響範囲: 顧客側 LIFF（/home /record /profile /goals /weekly /prediction /announcements /menu /chat）
- staging 動作確認後、社長指示で main へマージ。お知らせ機能は `NOTION_ANNOUNCEMENTS_DB_ID` を `.env.local` / `.env.staging` / Vercel env に追加し、Notion Integration を新DBに招待した後に有効化される
- 関連: notion-ops でお知らせ Notion DB 作成済（DB ID `ae40c5c373d44e569a9e3a74318f755d`）

## 2026-05-24 – change(store): 承認制モードのUIを非公開化（ソフトリバート）
- change(admin/store): `/store/customers` から「招待方式」切替トグル UI を撤去。`inviteMode` state・`updateInviteMode` 関数・`/api/admin/tenant-settings` GET 呼び出しを削除
- change(admin/store): 招待コピーボタンを「ユーザー招待フォームをコピー」（個別招待・7日有効）に固定
- 残置: バックエンド（lib/tenant.ts inviteMode・/api/admin/tenant-settings 両 verb・/api/admin/customers/[id]/approve POST・/api/liff/register の kind=approval 分岐・Notion テナント DB「招待モード」列・全顧客 DB「承認待ち」option・LiffGate / register の「承認待ち」画面）はすべて温存
- 残置: `/store/customers` の「承認待ち」フィルタタブ・「承認」ボタンは温存（既存承認待ち顧客が出現した際の救済用、表示影響なし）
- 影響範囲: 管理画面（/store/customers の見た目）のみ。API・DB・顧客側 LIFF への影響なし
- 経緯: Phase 2 staging リリース後、社長が UI を見て「わかりづらい」と判断 → モード切替の業務複雑度が個別招待のシンプルさを上回ると判断 → ソフトリバート決定。将来 UI 再公開時は本ファイルにトグル・state・API GET 呼び出しを復活させるだけで再利用可能

## 2026-05-24 – security(approve): cross-tenant 承認の脆弱性修正
- fix(api): `/api/admin/customers/[id]/approve` POST に `assertCustomerOwnership` ガード追加。テナント A の管理者が テナント B の顧客 pageId を知っていれば承認できる cross-tenant 脆弱性を解消（403 で弾く）
- feat(lib/notion.ts): `assertCustomerOwnership(pageId)` 関数を新規追加。pageId が現テナントの顧客 DB 配下であることを Notion の parent.database_id で検証。既存 `assertFoodRecordOwnership` と同パターン
- 発見経緯: Phase 2 code-review で Blocker として指摘
- 影響範囲: API（/api/admin/customers/[id]/approve）。実際の悪用には他テナントの pageId 知識が必要だが、設計の堅牢性として必須

## 2026-05-24 – feat: 承認制モード + モード切替UI（Phase 2）
- feat(notion-db): FitMeal テナント DB に「招待モード」select 列追加（`個別招待` / `承認制`、未設定なら個別招待扱い）
- feat(notion-db): 全テナント顧客 DB（メヲダス本店・staging・テスト）の「ステータス」select に「承認待ち」option を追加（yellow、先頭配置）
- feat(lib/tenant.ts): TenantConfig に `inviteMode?: 'individual' | 'approval'` 追加
- feat(lib/notion.ts): TenantRow に inviteMode 追加、listTenantRows でパース、updateTenantRow で書込対応
- feat(lib/tenantResolver.ts): inviteMode を TenantConfig に伝搬。未設定なら 'individual' フォールバック
- feat(api): `/api/admin/tenant-settings` GET/PATCH 新規追加。現在テナントの inviteMode を取得・更新。invalidateTenantCache 付き
- feat(api): `/api/admin/customers/[id]/approve` POST 新規追加。「承認待ち」→「進行中」に状態遷移。withAdminTenant 認証必須
- change(api): `/api/liff/register` 改修。`x-invite-token` の `kind` を withInviteOrCurrentTenant 経由で fn に渡し、`kind=approval` の場合は `foodStatus='承認待ち'` で作成。トークン無しの場合はテナント設定 `inviteMode` を見て決定。GET/POST レスポンスに `foodStatus` を含める
- feat(admin/store): `/store/customers`（`/admin/customers/page.tsx`）に「招待方式」切替 UI 追加（個別招待 / 承認制、楽観的更新 + rollback）
- feat(admin/store): copyApplyLink が `inviteMode` を見て URL を発行（individual: 7日有効、approval: 30日有効・公開URL）。コピー文言・有効期限案内も切替
- feat(admin/store): 顧客一覧の「承認待ち」行に **「承認」ボタン** 追加。クリックで /api/admin/customers/[id]/approve を叩き 進行中 に遷移
- feat(admin/store): STATUSES フィルタに「承認待ち」追加。StatusBadge に yellow バッジ追加
- feat(home): `/home/register` の登録結果が `foodStatus='承認待ち'` の場合は「お申込みを受け付けました（承認待ち）」画面を表示。既登録チェックでも `foodStatus` を取得し既存「登録済み」画面と分岐
- feat(home): `/home`（LiffGate）の非進行中ステータス画面が `承認待ち` の場合は専用文言「ジムからの承認待ちです / ジム側で承認が完了するとご利用開始できます」を表示
- 影響範囲: 顧客側 LIFF（/home, /home/register, LiffGate）・管理画面（/store/customers）・API（/api/admin/tenant-settings, /api/admin/customers/[id]/approve, /api/liff/register）・Notion DB
- メヲダス本店への影響: 招待モード未設定（=個別招待扱い）のためデフォルトで影響なし。既存顧客の食事管理ステータスは「進行中」のままで LIFF は通常動作
- 既存個別招待モードへの影響: なし（既存挙動を完全互換、`kind: 'individual'` がデフォルト）
- 設計経緯: Phase 1 完了後に社長との対話で「承認制モード」を Phase 2 として確定。集客フェーズ（公開URL を website/SNS に貼る運用）を可能にする業務価値を最優先

## 2026-05-24 – fix(notion): createTenantCustomerDb に欠落列4つを追加
- fix(lib/notion.ts): `createTenantCustomerDb` の properties に `生年月日`（date）・`メールアドレス`（email）・`電話番号`（phone_number）・`フリガナ`（rich_text）を追加
- 影響範囲: 新規 B2B テナントのセルフサーブ・オンボーディング経由で作成される顧客 DB のスキーマ。既存テナントの顧客 DB には影響なし
- 背景: 本番 Sentry エラー「ツアーリセット日時 is not a property that exists」の根本原因対策。既存テスト用テナント DB は手動追加済み。新規顧客 DB で同種の欠落を防ぐための予防修正

## 2026-05-24 – fix(register): 「登録済み」画面の名前空白表示を修正
- fix(api): `/api/liff/register` GET レスポンスに `customerName` と `officialLineUrl` を含めるように変更（既登録時のみ）
- fix(home): `/home/register` の事前チェック（onMount）で取得した `customerName` / `officialLineUrl` を state に反映。`already-registered` 画面で名前が空文字になり「　は登録済みです」と表示されていた問題を解消
- fix(home): 名前が取れなかった場合のフォールバック文言を「すでに登録済みです」「登録完了しました」に変更（先頭の不自然な空白・「は」の脱落を防止）
- 影響範囲: 顧客側 LIFF（/home/register の登録完了/登録済み画面）・API（/api/liff/register GET）
- 発見経緯: staging リリース後 QA 中、社長が招待URLを既登録のLINEアカウントで開いた際にスクリーンショットで指摘

## 2026-05-24 – feat: 進捗管理 日付セレクタ・分析画面連動・リダイレクト対応
- feat(admin/store): `/admin/progress` に日付セレクタ追加。「← 前日 / date input / 翌日 →」構成。翌日ボタンは今日より後に進めない（disabled）。日付変更でリスト再フェッチ
- feat(api): `/api/admin/progress` に `?date=YYYY-MM-DD` クエリ対応。未指定は JST 今日。食事・運動・体重（前日比）の集計対象日を指定日に変更
- change(admin/store): 進捗一覧の顧客行クリックを `/progress/[id]`（顧客設定画面）から `/analysis?customer=<pageId>&date=<選択日>` へ変更。`<Link>` から `useRouter().push()` に切り替え
- feat(admin): `/admin/analysis` の `Inner()` が `?customer=<pageId>` および `?date=YYYY-MM-DD` クエリパラメータを初期 state に反映。旧 `?customerId=` パラメータも後方互換維持。`?date=` 指定時は開始日＝終了日＝指定日で単一日モード起動。クエリなしアクセス時のデフォルト（today 単一日）は変更なし
- change(admin/store): `/admin/progress/[id]` と `/store/progress/[id]` を `redirect()` 薄サーバーコンポーネントに置き換え。旧 URL への直アクセスはそれぞれ `/admin/analysis?customer=<id>` `/store/analysis?customer=<id>` へリダイレクト
- 影響範囲: 管理画面（/admin/progress, /admin/analysis, /store/progress, /store/analysis）・API（/api/admin/progress）。顧客側 LIFF は変更なし

## 2026-05-24 – feat: 署名付き招待URL方式（SaaS オンボハードル解消 Phase 1）
- feat(lib): `lib/inviteToken.ts` を新規追加。HMAC-SHA256 署名でテナントIDと有効期限を改ざん不可能な形にエンコード。秘密鍵は `INVITE_TOKEN_SECRET`（未設定なら `ADMIN_SESSION_SECRET` をフォールバック）
- feat(api): `/api/admin/invites/create` を新規追加。`/store/customers` の「ユーザー招待」ボタンが呼び出す。7日有効・1〜30日でクランプ
- feat(api): `/api/public/invite/resolve` を新規追加。クライアント側が招待トークンを `tenantId` に交換する公開エンドポイント
- feat(admin/store): `/store/customers`（再エクスポート元 `/admin/customers/page.tsx`）の「ユーザー招待フォームをコピー」ボタンが署名付き URL を生成するように変更。`/home/register?t=<token>` 形式。招待API障害時は旧 `?tenantId=` 形式にフォールバック
- feat(home): `/home/register` が `?t=<signed_token>` クエリを受け付け、`/api/public/invite/resolve` で検証 → `x-invite-token` ヘッダで POST → サーバー側で再検証してテナントを上書き。旧 `?tenantId=` 平文も後方互換維持
- feat(home): 登録成功後に `localStorage.fitmeal_tenant_id` を保存。次回 LIFF 起動時にも同じテナント文脈で API 呼び出しが行えるようにする
- feat(home): `/home`（LiffGate）も `?t=` `?tenantId=` を読み取って localStorage 保存。`/home/register` への 404 リダイレクト時にクエリパラメータを保持
- feat(home): `lib/apiFetch.ts` が `localStorage.fitmeal_tenant_id` を自動で `x-tenant-id` ヘッダに付与（共通 LIFF 配下の SaaS テナントが「自分のジム」のデータにアクセスできるようにする要）
- change(home): `/home/register` フォームの必須項目を「お名前」のみに緩和（身長・現在体重は任意化、placeholder に「(任意)」表記）。トレーナーが後から /admin で入力できる
- change(api): `/api/liff/register` GET/POST が `x-invite-token` を受け付け、HMAC 検証して verified `tenantId` で `runWithTenantById` 実行。身長/体重欠如時は目標 PFC 計算をスキップ
- change(api): `/api/liff/register` GET レスポンスに `alreadyRegistered` を見て `/home/register` 側で「登録済み」画面に即遷移（既登録者がフォームを再入力する無駄を排除）
- feat(api): `/api/liff/register` POST レスポンスに verified `tenantId` を含めるように変更。クライアント側で localStorage 同期に使用
- 影響範囲: 顧客側 LIFF（/home, /home/register, lib/apiFetch.ts）・管理画面（/admin/customers, /store/customers）・API（/api/admin/invites/*, /api/public/invite/*, /api/liff/register）
- メヲダス本店への影響: なし。既存の `x-liff-id` 解決経路と専用 LIFF 構成はそのまま維持（`lib/withTenant.ts` の優先順位 x-tenant-id > x-liff-id > default を踏襲）
- 環境変数: `INVITE_TOKEN_SECRET`（推奨）または `ADMIN_SESSION_SECRET`（フォールバック）が必要。staging Preview env は既存の ADMIN_SESSION_SECRET でそのまま動作する想定
- 既知の MVP 制約: nonce による 1 回使い切り未実装。漏洩したトークンは 7 日間有効のまま再利用可能（次フェーズで対応）。承認制モード・複数ジム切替 UI・モード切替設定 UI は未実装（次フェーズ）
- 設計経緯メモ: 社長との対話で「LINE Developers 設定撤廃 + 共通 LIFF + URL 署名トークンでテナント識別」方針を確定し MVP として実装

## 2026-05-23 – feat: 進捗管理メニュー追加（/admin・/store 両対応）
- feat(admin/store): AdminShell に「進捗管理」タブ（TrendingUp アイコン）を先頭追加、「顧客」タブを「顧客設定」にリネームし `/customers` サブルートへ移動
- feat(admin/store): `/admin` `/store` トップをサーバーコンポーネントに変換。`onboardingCompletedAt` を見てオンボーディング完了済み → `/progress`、未完了 → `/customers` へリダイレクト
- feat(admin/store): `/admin/customers/page.tsx` を新規切り出し（`/store/customers/page.tsx` は re-export）。既存 `/admin/customers/[id]` `/store/customers/[id]` はそのまま動作
- feat(admin/store): `/admin/progress` `/store/progress` 進捗管理一覧画面を新規作成。今日の食事（kcal/件数）・体重（最新値＋前日比）・運動（分数）を3カラム表示
- feat(api): `/api/admin/progress` を新規作成。顧客リスト取得後に食事DB・体重DB・運動DBを並列クエリ（食事/運動は一括、体重は concurrency=5 で顧客別）。Notion レート制限対策済み
- feat(admin/store): `/admin/progress/[id]` `/store/progress/[id]` 進捗詳細画面を追加（既存 customers/[id] を re-export）。パスに `/progress/` が含まれる場合は `back` を `/progress` へ変更、レポート送付ボタンを常時表示
- 影響範囲: 管理画面（/admin, /store）・API（/api/admin/progress）。顧客側 LIFF は変更なし

## 2026-05-23 – fix(register): 401 リトライをテナント固有 liffId 優先に変更
- `/home/register` で API が 401 を返したときのリトライが `NEXT_PUBLIC_LIFF_ID` を直接使っていた → state 側で解決済みの `liffId`（tenant-config 経由）を優先、無い場合のみ env にフォールバック
- 影響: 顧客側 LIFF（/home/register）。2社目以降のテナント（自前 LIFF 持ち）でも 401 リトライが正しく動くようになる。メヲダス1社のみの現状では実害なし

## 2026-05-23 – fix(admin): ツアーリセット UI 文言明確化 ＋ LP 連携 TODO 追加

- change(admin): `/admin/customers/[id]` のオンボーディングリセットボタン文言を「オンボーディングをリセット」→「ホーム＋食事記録ツアーを再表示」に変更。ホームと食事記録ツアーの両方がリセット対象であることを明示
- change(admin): セクション名を「オンボーディングリセット」→「ツアーリセット」に変更。説明文に「ホーム初回ガイド・食事記録ガイドを再表示」を明記
- change(admin): confirm ダイアログ文言を「ホーム＋食事記録ツアーをリセットします」に変更
- change(admin): リセット成功トーストを「リセット完了。顧客側で次回起動時から再表示されます」に変更
- docs: `docs/LP_INTEGRATION_TODO.md` 新規追加。LP（fitmeal-lp）がやるべきフォーム差し替え手順・フィールドマッピング・動作確認手順・本番切り替え前チェックリストを文書化
- 影響範囲: 管理画面（/admin/customers/[id] の UI 文言のみ）。顧客側・API は変更なし
- Notion 列確認結果: 本番 FitMeal 顧客 DB（2d6ec0c0...）・staging 顧客 DB（31cbec9f...）ともに `ツアーリセット日時`（date型）列が存在することを MCP で確認済み。Notion スキーマ修正は不要

## 2026-05-23 (夜・後追い) – fix(signup): コードレビュー指摘の defensive 修正

- fix: `/api/public/signup` の入力長を Stripe metadata 500 文字制限に合わせて切り詰め（gymName/ownerName を 100 文字、phone を 20 文字、email を 200 文字）
- fix: `/api/public/signup` の `headcount` を 1..500 にクランプ（bot が巨大な quantity を Stripe に流して法外金額が表示されるのを防止）
- fix: `/api/public/signup` の `success_url` を Vercel preview URL ではなく本番ドメインに固定。`NEXT_PUBLIC_APP_URL` 環境変数があればそれを優先、無ければ `staging.fitmeal.jp` / `app.fitmeal.jp` を hostname から推定
- fix: `/api/public/signup` の in-memory rate limit map に 1万 entry 超でクリーンアップを追加（warm instance のメモリリーク防止）
- fix: webhook `handleSelfServeCheckoutCompleted` で `gymName` が metadata に無い場合に黙ってデフォルト名で発行せず abort + console.error（識別不能テナントの混入防止）
- chore: `/signup/welcome` の `<Suspense>` に `fallback={null}` 明示
- docs: `lib/provisionTenant.ts` に「3DB 並列作成成功 → insertTenantRow 失敗」時の孤立 DB 発生を既知制約として明記（Postgres 移行で根本対処予定）
- 影響範囲: API（/api/public/signup・/api/stripe/webhook）・公開ページ（/signup/welcome）・lib（provisionTenant 仕様コメント）
- 関連: 同日夜のセルフサーブ申込 Phase 2 実装に対する code-reviewer の指摘 [1][3][4][5][6][7][8]
- 残課題: [1] (provisionTenant 部分失敗時の真の冪等化) は Postgres 移行と同時対応

## 2026-05-23 – feat: セルフサーブ申込 Phase 2（LP→Stripe→webhook→テナント自動発行）

- feat: `lib/provisionTenant.ts` 新規。テナント自動プロビジョニングの共有関数（Notion 3DB 作成・テナント行・店舗・初期PW・メール送信を1関数に集約）。**冪等**（stripeCustomerId 既存ヒット時は再利用）
- refactor: `app/api/admin/tenants/route.ts` POST を `provisionTenant` 経由に置換。挙動は維持（admin 経由は `selfServe:false` でログイン情報メールを送信）
- feat: `app/api/public/signup/route.ts` 新規。LP からの公開申込みエンドポイント。CORS（fitmeal.jp 限定）・honeypot（_gotcha）・IP単位レート制限（1分3件）・入力検証・Stripe Checkout Session 作成（trial 14日・payment_method_collection: always・metadata.selfServe=true）
- feat: `app/api/stripe/webhook/route.ts` 拡張。`checkout.session.completed` で `metadata.selfServe==='true'` を検知し `handleSelfServeCheckoutCompleted` 経由でテナント自動発行（冪等）→ subscription metadata に tenantId 後追い → `handleSubscriptionUpdate` で seatLimit/planTier 確定
- feat: `app/signup/welcome/page.tsx` + `app/signup/layout.tsx` 新規。Stripe Checkout 成功 URL の公開着地ページ。受付完了・トライアル案内・次ステップ案内
- feat: `lib/email.ts` に `welcomeEmail` 新規追加（既存 `loginInfoEmail` と並列）。トライアル終了日と LINE 連携ガイド URL（help.fitmeal.jp）を本文に含む
- chore: `components/FooterNav.tsx` に `/signup/*` 配下を非表示パスに追加
- chore: `fitmeal-lp/SIGNUP_PHASE2_LP_SWAP.md` 新規。本番反映時の LP 切替手順・必要 env・ロールバック手順をドキュメント化（**LP 本体は未変更**・本番反映タイミングを社長が握る）
- 影響範囲: API（/api/public/signup 新設、/api/stripe/webhook 拡張、/api/admin/tenants 内部実装変更）・公開ページ（/signup/welcome 新設）・lib（provisionTenant/email/FooterNav）・LP（手順書のみ・本体未変更）
- 必要な本番 env（社長作業）: `STRIPE_PRICE_SUPPORT_FEE`・`STRIPE_PRICE_PER_USER`（標準プラン本番 Price ID）・Stripe 本番 webhook endpoint 登録・help.fitmeal.jp の onboarding ガイド公開
- 設計書: `docs/SELFSERVE_SIGNUP_DESIGN.md` Phase 1 スコープ準拠

## 2026-05-22 – feat: セルフサーブ・オンボーディング Phase 1（ジム経営者向け LINE 連携ウィザード）
- feat(A): テナント別 LIFF ランタイム解決。`GET /api/public/tenant-config?tenantId=` を追加（CORS 許可・s-maxage キャッシュ）。`lib/liff.ts` の `initLiff(overrideLiffId?)` を後方互換拡張。`lib/tenantLiff.ts` 新規追加（URL ?tenantId= → tenant-config fetch → liff.init）。`/home`・`/home/register` が tenantId 解決に対応
- feat(B): リッチメニュー自動構築 `lib/lineRichMenu.ts` 新規追加。`public/richmenu-default.png`（2500×1686）生成。createRichMenu / deleteRichMenu（冪等）実装
- feat(C): オンボーディング API 群（`/api/store/onboarding/` 配下）新規追加。state・verify-token・verify-liff・build-richmenu・test-push・issue-test-token。公開 API：`/api/public/onboarding/owner-userid`。一時トークン管理 `lib/onboardingTokens.ts`
- feat(D): ウィザード UI `app/store/onboarding/page.tsx` 新規追加（5 ステップ、中断再開可）。`/store` トップの未完了バナー追加。AdminShell のタブに「セットアップ」追加
- feat(D): LIFF テスト用ページ `app/home/onboard-test/page.tsx` 新規追加
- feat(F): Notion テナント DB（本番・staging 共用）に `onboardingStep`・`onboardingCompletedAt`・`richMenuId`・`ownerLineUserId` 列を追加。`lib/notion.ts`（TenantRow 型・updateTenantRow・listTenantRows）更新
- 影響範囲: 顧客側 LIFF（/home, /home/register, 新規 /home/onboard-test）・管理画面（/store/onboarding）・API（/api/store/onboarding/*, /api/public/tenant-config, /api/public/onboarding/owner-userid）・DB（Notion テナント DB）
- 既存テナント（メヲダス、staging）の挙動は維持（?tenantId= 無し時は NEXT_PUBLIC_LIFF_ID にフォールバック）

## 2026-05-22 20:00 – change(admin): store/admin 全ページに完了トースト通知を統一
- 管理画面: store / admin 全ページに保存・更新・削除の完了トースト（Sansan風・画面下部の緑バー）を追加
- components/Toast.tsx（新規）・app/admin/layout.tsx（新規）を追加。Provider を /store・/admin レイアウトでマウント
- 影響範囲: 管理画面（/store, /admin）

## 2026-05-22 (本番) – fix(gemini): 補正モードで店名・場所の補足が食品アイテム化されるバグを修正

- bug: 「テキスト補正」で「サイゼリヤです。」等の店名・場所・状況の補足を入力すると、AI がそれを料理の追加申告と誤認し、items に新規アイテム（kcal付き）として追加していた
- fix: 補正モードプロンプト（lib/gemini.ts）にルール6・7を追加。店名・購入場所・食事状況の補足は items 化せず、既存アイテムの公式栄養成分値を精緻化するヒントとしてのみ使用。items への追加は具体的な料理名の追加申告（「味噌汁も食べた」等）時のみに限定
- 影響範囲: API（食事 AI 解析）/ 顧客側（テキスト補正の結果）
- 関連: 社長報告スクリーンショット（5/20 夕食「サイゼリヤです。」365kcal 誤登録）

## 2026-05-22 (本番) – change(admin): 「席数」表記の全体統一＋課金ページ警告バナー全幅化

- 用語統一: 残っていた「席数」「契約席数」UI 表記を「利用可能アカウント数」に統一
  - テナント編集（/admin/tenants/[id]）の課金モード説明・「契約席数」入力ラベル・Stripe反映セクションの「席数」ラベル
  - /admin（残り1席バナー）・/admin/customers/[id]（削除確認ダイアログ・削除セクション説明）・/admin/plans（最低席数ラベル ×2）
  - API エラーメッセージ: /api/admin/tenants/[id]（Stripe連動モードの編集禁止）・apply-stripe（最低数バリデーション）
- change: /admin/billing の警告バナー（上限到達・残り1席・解約予約中・お試し・未払い）を inline-flex → flex w-full で全幅化
- 影響範囲: 管理画面（/admin 配下）・API（/api/admin）。コード内コメント・Notion DB プロパティ名「契約席数」は変更なし

## 2026-05-22 (本番) – release: 課金制御機能（課金モード3種・プラン管理DB・Stripe反映）staging一括反映

- 本番反映: 社長指示により staging → main マージ。課金制御機能および先行 staging 分（席数上限UI改修・Notion再発防止）を一括反映
- feat: テナント単位の「課金モード」（無制限/手動/Stripe連動）を導入。無制限=社内テスト無制限・手動=PoC等の席数手動管理・Stripe連動=通常有償
- feat: プラン定義DB fitmeal-plans 連携。/admin/plans でプラン CRUD（PoC・エンタープライズ対応）
- feat: /admin/tenants/[id] から Stripe へプラン・席数を反映（apply-stripe）
- fix: Stripe webhook に課金モードガード（Stripe連動以外のテナントは webhook で書き換えない）
- 詳細は以下の各 (staging) エントリ参照

## 2026-05-22 (staging) – change(admin): 課金ページの「席数」表記を「利用可能アカウント数」に統一

- 用語統一: /admin/billing 全体の「契約席数」「席数」UI 表記を「利用可能アカウント数」に変更（上限/残り1席バナー・プログレスバー注記・プラン一覧・新規契約フォーム・運営管理プラン表示・「使用 / 契約」→「使用 / 利用可能」）
- 用語統一: SeatChangeModal の見出し「席数変更」→「利用可能アカウント数を変更」
- 「現在の契約」「新規契約」など契約そのものを指す表記、コード内コメント、Notion DB プロパティ名「契約席数」は変更なし
- 影響範囲: 管理画面（/admin/billing）

## 2026-05-22 (staging) – qa: 課金制御機能 QA 完了（bcb152f）・回帰チェックリスト更新

- QA 実施: fitmeal-qa によるリリース前 QA 実施。自動検証 14項目通過・条件付き GO
- 自動検証: 全新規 API エンドポイントの認証ガード（401/403）確認済み
- 自動検証: Notion fitmeal-plans DB アクセス確認（listPlans/createPlan/updatePlan）
- 自動検証: billingMode バリデーション・Stripe連動モードでの seatLimit 編集禁止ガードをコード確認
- 自動検証: webhook 課金モードガード（Stripe連動以外は早期 return）をコード確認
- 自動検証: 顧客 LIFF ゴールデンパス API（/api/today・/api/notifications 等）が認証ガード維持
- 手動確認待ち: BL12〜BL18（/admin/plans 画面・課金モード切替・/store/billing 表示分岐・Stripe Checkout 到達）
- 更新: docs/qa-regression-checklist.md に BL1〜BL19（課金制御チェック項目）追加
- 影響範囲: docs/ のみ（コード変更なし）

## 2026-05-21 (staging) – fix(billing): 課金モードの API レベルガード追加（コードレビュー Medium/Low 対応）

- fix(app/api/stripe/checkout/route.ts): 課金モードが Stripe連動 以外（無制限・手動）のテナントは課金画面からの自己申込みを 403 で拒否。UI 非表示に加え API レベルの防御を追加
- fix(app/api/stripe/update-seats/route.ts): 同上、Stripe連動 以外のテナントは席数変更 API を 403 で拒否
- fix(app/api/admin/tenants/[id]/route.ts): billingMode を許可値（無制限/手動/Stripe連動）でバリデーション。Stripe連動モードでの seatLimit 直接編集を 400 で拒否（席数は Stripe が真実）
- 影響範囲: API
- ビルド確認: npm run build 成功

## 2026-05-21 (staging) – fix(billing): コードレビュー指摘修正（webhook monthlyPrice・update-seats dead code）

- fix(app/api/stripe/webhook/route.ts): handleSubscriptionUpdate の monthlyPrice 計算を Stripe 実額ベースに変更。旧実装は getMonthlyTotal(seatLimit) を使っており、非標準プラン（PoC・エンタープライズ）で SUPPORT_FEE=¥5,500 を誤加算していた。実際の supportFeeAmount + perUserUnitAmount * perUserQuantity から算出するよう修正。getMonthlyTotal インポートも削除
- fix(app/api/stripe/update-seats/route.ts): 全 items 削除→置換方式への移行に伴い不要になった perUserItemId 検索ロジック（旧 item 識別ループ・エラーガード）を削除。inline price_data サブスクリプションで誤って 400 を返すリスクを解消。不要な listPlans インポートも削除
- 影響範囲: API / Stripe webhook
- ビルド確認: npm run build 成功

## 2026-05-21 (staging) – feat: 課金制御フル実装（課金モード3種・プラン管理DB・Stripe反映・webhook ガード）

- feat(lib/tenant.ts): `FITMEAL_PLANS_DB_ID` 定数追加（`5962b6528bb04451afdbf54122cffabc`）
- feat(lib/notion.ts): `PlanDef` 型定義。`TenantRow` に `billingMode`/`planCode` 追加。`listPlans`/`getPlanByCode`/`createPlan`/`updatePlan` を新規追加。`listTenantRows`/`updateTenantRow` を `billingMode`/`planCode` 対応
- feat(lib/stripe.ts): `STANDARD_VOLUME_TIERS` 定数、`getMonthlyTotalFromPlan(plan, seats)`、`buildSubscriptionLineItems(plan, seats)` を追加。planCode=standard は env フォールバック
- feat(lib/seats.ts): `getSeatStatus` を課金モード（無制限/手動/Stripe連動）で分岐。戻り値に `seatSource` 追加。無制限→isOverLimit常にfalse
- feat(app/api/stripe/webhook/route.ts): handleSubscriptionUpdate/Deleted/InvoicePaymentFailed に課金モードガード追加（Stripe連動以外は早期return）。per-user Price ID 識別を全プラン定義 + env ベースに拡張
- feat(app/api/admin/plans/route.ts): プラン一覧GET/作成POST（withMasterOnly）新規
- feat(app/api/admin/plans/[code]/route.ts): プラン編集PATCH（withMasterOnly）新規
- feat(app/api/admin/tenants/[id]/route.ts): PATCH に billingMode/seatLimit/planCode を追加
- feat(app/api/admin/tenants/[id]/apply-stripe/route.ts): テナントのプラン・席数をStripeに反映（未契約→Checkout URL発行 / 契約済み→subscription.update）
- feat(app/api/stripe/checkout/route.ts): planCode 受取・getPlanByCode でプラン解決・buildSubscriptionLineItems 使用・metadata に planCode 付与
- feat(app/api/stripe/update-seats/route.ts): プラン変更（価格入替）対応、全プラン定義から per-user Price ID 集合を構築
- feat(app/api/admin/billing/info/route.ts): billingMode/seatSource をレスポンスに追加
- feat(app/admin/plans/page.tsx): プラン管理画面新規（一覧・作成・編集）
- feat(app/admin/AdminShell.tsx): ナビに「プラン管理」タブ追加（masterOnly）
- feat(app/admin/tenants/[id]/page.tsx): 課金モード切替・手動席数入力・プランコード選択・Stripe反映ボタンを追加
- feat(app/admin/billing/page.tsx): 課金モード 無制限/手動 のテナントは「運営管理プラン」表示、自己申込みUI非表示。解約済み/未払いバナーも非表示
- 影響範囲: 管理画面（master専用）/ API / billing UI（顧客側）

## 2026-05-21 (staging) – feat: 席数上限 UI/UX 改修（用語統一・バナー全幅・招待ボタン無効・登録フォーム上限ガード）

- change(admin/page.tsx): 上限到達バナー・残り1席バナーを `inline-flex` → `flex w-full` で全幅化。上限バナー本文を2行（太字 + リンク inline）構成に変更
- change(admin/page.tsx): 「契約席数」→「利用可能アカウント数」（UI表示のみ。`lib/notion.ts` の Notion プロパティ名は変更なし）
- change(admin/page.tsx): `copyApplyLink` を `seatInfo?.isOverLimit` 時に早期 return するよう修正。招待ボタンを `disabled` + グレー配色に
- change(admin/billing/page.tsx): 席数プログレスバーの「契約席数」ラベルを「利用可能アカウント数」に変更（UI表示のみ）
- feat(api/liff/register/route.ts): GET ハンドラを追加（`withLiffTenantAccessToken` でラップ）。`{ alreadyRegistered, overLimit }` を返す
- feat(api/liff/register/route.ts): POST に席数上限チェックを追加（既存顧客 early return の後）。上限時は 403 を返す
- feat(home/register/page.tsx): Phase 型に `'over-limit'` を追加。LIFF init 後に GET `/api/liff/register` で上限チェックし、`overLimit && !alreadyRegistered` なら上限案内画面を表示
- 影響範囲: 管理画面（/admin・/admin/billing）、顧客側 LIFF（/home/register）、API（/api/liff/register）

## 2026-05-21 (staging) – fix: Notion API エラー再発防止（createTenantCustomerDb スキーマ補完 + メタDB マスタキー分離）

- fix(A): `createTenantCustomerDb` に `ツアーリセット日時` / `オンボーディング完了日時` / `登録完了日時` (date) を追加。新テナント作成時のスキーマ差分に起因する 400 validation_error を解消
- fix(B): `listTenantRows`（FitMeal テナント管理メタDB アクセス）を `NOTION_MASTER_API_KEY ?? NOTION_API_KEY` で呼ぶよう変更。`NOTION_MASTER_API_KEY` 未設定時は従来と同一挙動。新テナント追加時の 404 object_not_found 再発防止
- 影響範囲: API / テナントプロビジョニング（管理画面）。既存テナントの顧客DB・食事DB へのキー解決は変更なし
## 2026-05-21 (本番) – release: オンボツアー修正・登録完了日時・設定中整理・招待フォーム改善 staging一括反映

- fix: 自己登録顧客に食事記録オンボーディングツアーが表示されない不具合を修正（登録時 `onboardingCompletedAt` の防御クリア）
- feat: 顧客の「登録完了日時」を Notion 顧客DBに保存し、管理画面の顧客詳細に表示
- change: 管理画面の招待ボタンを「ユーザー招待フォームをコピー」に文言変更、コピー時に案内定型文を付与
- refactor: 新フローで未使用の「設定中」ステータスをコード・Notion顧客DBから整理。設定中前提の dead code（customers-cleanup cron・bulk-cleanup）を削除
- change: /record・/exercise・/weight のオンボーディングツアーをホームと同じ吹き出し型に統一（黄色い矢印を廃止）
- 本番反映: QA 条件付きGO ＋ 社長確認を経て、社長指示によりマージ。詳細は以下の各 (staging) エントリ参照

## 2026-05-21 (staging) – change: オンボーディングツアーを吹き出し型に統一（黄色い矢印を廃止）

- change(OnboardingTour): /record・/exercise・/weight のツアーを、ホームのツアー（OnboardingFlow）と同じ**吹き出し型**に変更。黄色いアニメーション矢印を廃止し、ツールチップに白い三角の尾を付けて target を指す形に。尾の水平位置は target 中心を指すよう算出（角に被らないようクランプ）
- ステップ毎に説明文の行数が違ってもコメント欄の高さ差が気にならなくなる（尾がツールチップに固定されているため）。説明文の `min-h`/中央揃えは不要になり撤去
- 影響範囲: 顧客側（/record・/exercise・/weight のオンボーディングツアー）

## 2026-05-21 (staging) – change: 招待ボタン文言を「ユーザー招待フォームをコピー」に

- change(admin): 顧客一覧の招待ボタン文言を「ユーザー招待フォーム」→「ユーザー招待フォームをコピー」（コピー操作であることを明確化）
- 影響範囲: 管理画面 /admin・/store

## 2026-05-21 (staging) – refactor: 「設定中」ステータス整理・dead code 削除

- change(app/admin/page.tsx): `STATUSES` 配列から「設定中」削除。`StatusBadge` の「設定中」色分け分岐削除
- change(app/admin/customers/[id]/page.tsx): `STATUS_OPTIONS`・`STATUS_BADGE_CLASSES`・`STATUS_DESCRIPTIONS` から「設定中」削除
- change(app/api/admin/customers/route.ts): POST の `foodStatus` デフォルトを「設定中」→「進行中」に変更（呼び出し元UIは存在しないが整合のため）
- change(app/api/public/apply/route.ts): `createCustomer` の `foodStatus: '設定中'` を「進行中」に変更。`/apply` ページは `app/apply/page.tsx` が存在するが管理画面・LIFF 双方からリンクなし（招待フローは `/home/register` に移行済み）。API 本体は CORS 公開 API のため即削除せず書き込みのみ是正
- delete(app/api/cron/customers-cleanup/route.ts): 「設定中」顧客の自動 cron 削除 route を廃止。新フローでは「設定中」が生まれないため恒久 no-op だった
- delete(app/api/admin/customers/bulk-cleanup/route.ts): 「設定中」顧客の一括削除 API を廃止。呼び出し元 UI（14日バナー）は既に撤去済み
- change(vercel.json): `customers-cleanup` cron エントリを削除
- change(lib/notion.ts): 新テナント顧客 DB プロビジョニングテンプレートの `食事管理ステータス` select から「設定中」オプション削除
- change(lib/seats.ts, app/admin/billing/page.tsx): コメント・説明文の「設定中」文言を整合（実害なし）
- 影響範囲: 管理画面（/admin、/admin/customers/[id]、/admin/billing）、API（/api/admin/customers、/api/public/apply）、cron削除、lib/notion.ts

## 2026-05-21 (staging) – feat: ユーザー招待フォーム文言統一・定型文コピー・登録完了日時保存と表示

- change(app/admin/page.tsx): 「申し込みフォームのリンクをコピー」ボタン文言を「ユーザー招待フォーム」に変更（T1）
- change(app/admin/page.tsx): コピー内容をURLのみ→定型案内テキスト付きに変更（「食事管理プログラムへのご登録をお願いします。\n\n{URL}\n\nご登録後、画面の案内に従って公式LINEを友だち追加してください。」）。トースト文言も「ユーザー招待フォームのリンクをコピーしました」に整合（T2）
- feat(lib/notion.ts): Customer 型・parseCustomerFromPage・createCustomer・updateCustomer に `registrationCompletedAt`（Notion「登録完了日時」date プロパティ）を追加（T4）
- feat(lib/repository/customers.ts): CustomerPatch・CustomerCreateInput に `registrationCompletedAt` を追加（T4）
- feat(app/api/liff/register/route.ts): 顧客作成時に `registrationCompletedAt: nowJst()`（JST ISO 8601）を付与し Notion「登録完了日時」に書き込む（T4）
- feat(app/admin/customers/[id]/page.tsx): 顧客詳細の基本情報セクションに「登録完了日時」を表示（T4）
- 影響範囲: 管理画面（/admin、/admin/customers/[id]）、API（/api/liff/register）、lib/notion、lib/repository/customers

## 2026-05-21 (staging) – fix: /store 申し込みフォームボタン確認 + 自己登録時 onboardingCompletedAt クリア

- fix(app/api/liff/register/route.ts): `createCustomer` 後に `customer.onboardingCompletedAt` が設定されていた場合に即座に null にリセット。Notion DB 側のデフォルト値等で意図せず設定されても初回 /home 起動でオンボーディングツアーが正常に表示されるよう防御。`patchCustomer` を import 追加
- confirm(app/store/page.tsx): `/store` 顧客一覧は `admin/page` を re-export 済みのため「申し込みフォームのリンクをコピー」ボタン・旧フロー撤去・`useAdminBase` による URL 切り替えが既に動作していることを確認。追加変更なし
- 影響範囲: API（/api/liff/register）、顧客側オンボーディングツアー表示

## 2026-05-21 (本番) – release: 新オンボーディング（LINE内自己登録フォーム）＋AI献立UI修正ほか staging一括反映

- feat: オンボーディングを招待トークン方式から「LINE内・申し込みフォーム自己登録」方式へ全面移行。`/home/register`（LIFF登録フォーム）＋`/api/liff/register`（LINE ID取得・重複チェック・PFC自動計算・進行中で作成）。`/home` LiffGate が未登録LINEユーザーを `/home/register` へ誘導。管理画面はテナント共通「申し込みフォームのリンクをコピー」に。旧 `/home/onboard`・`/onboard`・redeem API・招待リンクAPI・手動「新規顧客追加」を廃止
- fix(register): 申し込み認証の 401「IdToken expired」をアクセストークン方式で根本解決。生年月日を年/月/日プルダウン化、目標体重を任意化、目標達成日を追加、フッター誤タップ防止
- change: AI献立UIの3点修正・献立生成中ローディングのボトムシート化、レシピ生成APIの認証必須化、record オンボツアーの説明カード位置調整
- 本番反映: QA 条件付きGO ＋ 社長 staging 手動確認（A/B/C/D）通過済み。社長指示によりマージ
- 影響範囲: 顧客側オンボーディング全般・管理画面・AI献立・API。詳細は以下の各 (staging) エントリ参照

## 2026-05-21 (staging) – fix: 申し込みフォーム401を認証方式変更で根本解決（IDトークン→アクセストークン）

- fix(lib/withTenant.ts): `verifyLineAccessToken` 関数と `withLiffTenantAccessToken` ラッパーを追加。LINE `/v2/profile` API でアクセストークンを検証し userId を取得。IDトークン（`/oauth2/v2.1/verify`）と完全に独立したコードパス。アクセストークンキャッシュ（TTL 1分・最大100件）でレートリミット対応
- fix(app/api/liff/register/route.ts): `withLiffTenant`（IDトークン検証）→ `withLiffTenantAccessToken`（アクセストークン検証）に切り替え。テナント解決ロジックは同一
- fix(app/home/register/page.tsx): `liff.getIDToken()` → `liff.getAccessToken()` に変更。アクセストークンは LINE アプリが数時間管理するためフォーム入力中に期限切れにならない。401時は `liff.init()` 再実行でトークン更新を試み1回リトライ（無限ループ防止）。それでも401なら `liff.login()` でセッション一新
- fix(lib/withTenant.ts): `verifyLineIdToken` の診断用 `console.error` 詳細ログを削除（原因確定済み）
- 影響範囲: 顧客側（/home/register）・API（/api/liff/register）・lib/withTenant
- 背景: IDトークンは有効期限10分。フォーム入力時間が超えると `{"error":"invalid_request","error_description":"IdToken expired."}` で必ず401。`liff.login()` 再認証後も LIFF SDK が期限切れトークンをキャッシュし続けるため旧方式では解決不可

## 2026-05-21 (staging) – fix: 申し込み401ブロッカー根本修正 + 管理画面「新規顧客追加」削除

- fix(app/home/register/page.tsx): IDトークン期限切れ時の401を `liff.login()` による本物の再認証で解消。`refreshLiff()` / `liff.init()` 再呼び出しは新しいトークンを発行しないため廃止。フォーム入力値を sessionStorage に退避（`register_form_draft`）→ `liff.login({ redirectUri: 現URL })` → OAuth戻り後に自動復元。再認証ループはトークン取得できた場合のみリクエストを送る構造で防止
- fix(lib/withTenant.ts): `verifyLineIdToken` に一時診断ログ追加。LINE /oauth2/v2.1/verify が失敗した場合のステータスとレスポンスボディをサーバーログに出力（失敗原因の確定用）
- remove(app/admin/customers/new/): 管理画面「新規顧客追加」ページを削除。自己登録フロー一本化のため。手動作成レコードは LINE ID 紐付け不可で孤立・重複の原因になるため不要と判断
- remove(app/admin/page.tsx): 「新規顧客追加」ボタン・リンクと `UserPlus` import を削除
- fix(app/admin/stores/page.tsx): 削除した「新規顧客追加」への案内テキストを修正
- 影響範囲: 顧客側（/home/register）・管理画面（/admin、/admin/customers/new 削除）・lib/withTenant

## 2026-05-21 (staging) – change: 申し込みフォームの活動レベル「中程度」に説明を追加

- change(home/register): 活動レベルの選択肢「中程度」を「中程度（週2〜3回運動）」に変更（「低い（ほぼ運動なし）」「高い（毎日運動）」と表記を統一）。API 側の活動レベル正規化は `中` を含むかで判定しているため挙動に影響なし
- 影響範囲: 顧客側（`/home/register` 自己登録フォーム）

## 2026-05-21 (staging) – fix: 申し込みフォームQA3点（401リトライ・目標体重任意化・目標達成日追加）

- fix(app/home/register/page.tsx): ID トークン期限切れ時に `refreshLiff()` で再取得して1回リトライする実装を追加。raw fetch + getIdToken() のみだったため 401 が返ったまま登録失敗していた根本原因を解消
- fix(app/home/register/page.tsx, app/api/liff/register/route.ts): 「目標体重」を任意項目に変更。フロント側 required 属性・バリデーション撤去、API 側必須チェックから targetWeight を除外。未指定時は currentWeight をフォールバックとして calcGoals に渡す（現状維持として計算）
- feat(app/home/register/page.tsx, app/api/liff/register/route.ts): 「目標達成日」を任意項目として追加。生年月日と同様の 年/月/日 プルダウン方式（当年〜+3年）。YYYY-MM-DD 形式で API に送り Notion「目標達成日」date プロパティに保存（lib/notion.ts createCustomer・CustomerCreateInput はいずれも対応済みにつき変更なし）
- 影響範囲: 顧客側（/home/register）・API（/api/liff/register）

## 2026-05-21 (staging) – fix: オンボーディングQA指摘3点（tenantId引き継ぎ・InvitePanel廃止API撤去・生年月日Notion保存）

- fix(app/home/register/page.tsx): liff.login() の redirectUri に tenantId クエリを引き継ぐ。LINE未ログイン時に /home/register?tenantId=X を開くとログイン往復後 tenantId が失われ x-tenant-id ヘッダーが空になる不具合を解消
- fix(app/admin/customers/new/page.tsx): InvitePanel が廃止済みエンドポイント /api/admin/customers/[id]/invite-link を呼び続けていた問題を修正。廃止APIの呼び出しを削除し「申し込みフォームURLをLINEで送ってください」案内（/home/register?tenantId=…のコピーボタン付き）に置き換え。14日ルール文言も削除
- fix(lib/notion.ts, lib/repository/customers.ts, app/api/liff/register/route.ts): 自己登録時に生年月日が Notion に保存されない不具合を修正。CustomerCreateInput と createCustomer に birthdate フィールドを追加し、Notion「生年月日」date プロパティへ書き込むよう対応。/api/liff/register も birthdate を createCustomer に渡すよう変更
- 影響範囲: 顧客側（/home/register）・管理画面（/admin/customers/new）・lib/notion・lib/repository/customers・API（/api/liff/register）

## 2026-05-21 (staging) – fix: 登録フォームの不具合2点（フッター誤タップ・生年月日入力）

- fix(FooterNav): `/home/register`（自己登録フォーム）でフッターナビを非表示に。送信ボタンとフッターが重なり「申し込む」を押したつもりがフッターの「AI相談」を踏んで `/chat` に飛ぶ（＝登録未完了・完了画面が出ない）不具合を解消。オンボーディング画面はフッター非表示が正
- change(home/register): 生年月日入力をネイティブ日付ピッカー（`<input type="date">`）から 年／月／日 のプルダウン3つに変更。年を直接選べる・「設定/キャンセル/削除」の混乱を解消。日数は選択中の年月に応じて算出（うるう年・月末考慮）
- 影響範囲: 顧客側（`/home/register` 自己登録フロー）

## 2026-05-21 (staging) – fix: 自己登録フロー残課題4点（アレルギー削除・inviteToken削除・14日バナー削除・tenantId対応）

- fix(app/home/register/page.tsx): 「食事制限・アレルギー」セクション・state・送信ボディを完全削除
- fix(app/api/liff/register/route.ts): allergies 受け取り・ログ処理を削除
- fix(lib/withTenant.ts): `withLiffTenant` のテナント解決に `x-tenant-id` ヘッダーを追加。優先順位: 非本番=FITMEAL_TENANT_ID_OVERRIDE最優先（staging隔離維持）、本番=x-tenant-id→x-liff-id→デフォルト
- fix(app/admin/page.tsx): 14日未起動バナー・staleCount・isStale・bulkCleanup・cleaning state・Trash2 import を削除。リストカードの「14日超」バッジも削除
- fix(app/admin/page.tsx): 「申し込みフォームのリンクをコピー」が /api/admin/auth/me から currentTenantId を取得し、`?tenantId=<id>` 付きURLを生成するよう変更
- fix(lib/inviteToken.ts): 未使用ファイルを削除（全コードベースで参照なし確認済み）
- 影響範囲: 顧客側（/home/register）・管理画面（顧客一覧）・API（/api/liff/register）・lib/withTenant

## 2026-05-21 (staging) – feat: 招待トークン方式を廃止し LINE 内自己登録フォームに移行

- feat(app/home/register/page.tsx): 新規 LIFF 対応登録フォーム。LINE内（LIFF文脈）で開くと liff.login() 往復なしで LINE ID を取得しフォームを表示。外部ブラウザはエラー案内
- feat(app/api/liff/register/route.ts): 新規登録 API。withLiffTenant でラップ（LINE IDトークン検証+テナント解決）。LINE ID 重複チェック→createCustomer（lineUserId付き、foodStatus=進行中）→officialLineUrl 返却
- feat(app/home/_components/LiffGate.tsx): /api/customer/me が 404 を返した場合（顧客レコードなし）に /home/register へリダイレクト
- change(app/admin/page.tsx): 顧客ごとの「招待リンクをコピー」ボタン廃止。代わりにテナント共通「申し込みフォームのリンクをコピー」ボタンを追加（/home/register）
- deprecated(app/api/onboard/redeem/route.ts): 410 Gone スタブに差し替え
- deprecated(app/api/admin/customers/[id]/invite-link/route.ts): 410 Gone スタブに差し替え
- deprecated(app/home/onboard/page.tsx): /home/register へリダイレクト
- deprecated(app/onboard/page.tsx): /home/register へリダイレクト（後方互換）
- 影響範囲: 顧客側（/home, /home/register 新規）・管理画面（顧客一覧ボタン変更）・API

## 2026-05-21 (staging) – fix(home/onboard): LIFF 認証ループを sessionStorage token 保持で解消

- fix(app/home/onboard/page.tsx): `liff.login()` の `redirectUri` から `?token=...` クエリを排除。token を `sessionStorage` に保持し、LINE OAuth コールバック後（URL に token がない状態）でも復元できるようにした
- 修正前: `liff.login({ redirectUri: window.location.href })` → `redirectUri` に `?token=TOKEN` が含まれ、LINE が Endpoint URL `/home` にコールバックして `liff.state` で `/home/onboard` へリダイレクトした際に token が失われる可能性があった
- 修正後: `liff.login({ redirectUri: origin + '/home/onboard' })` + `sessionStorage.setItem('fitmeal_invite_token', token)` の組み合わせで、コールバック後の URL に関わらず token を復元できる
- ログイン成功後の `resolvedToken = sessionStorage.getItem(SESSION_KEY) || effectiveToken` で確実に token を取得してから redeem へ
- 影響範囲: 顧客側（`/home/onboard` 招待トークン引き換え画面のみ）
- 関連: staging 固有の未発見バグ（本番 /home/onboard も同じコードなので本番でも効果あり）

## 2026-05-21 (staging) – fix: 食事記録オンボーディングの説明カード位置を上に修正

- fix(app/record/page.tsx): オンボーディングツアーの下段ボタン3ステップ（食品DB／マイメニュー／テキストで記録）の説明カードを `placement: 'bottom'` → `'top'` に変更。ボタンの下に表示すると画面最下部（ナビバー際）に押し込まれて見づらかったため、ボタンの上に表示するよう修正
- 影響範囲: 顧客側（`/record` オンボーディングツアーのみ）

## 2026-05-21 (staging) – change: 認証完了画面の文言調整

- change(app/home/onboard): 認証成功画面から「最後にあと1ステップだけお願いします」の一文を削除
- change(app/home/onboard): 友だち追加案内文を「…友だち追加していただくと、」の後で改行（「リッチメニューから…」を次行へ）
- 影響範囲: 顧客側（`/home/onboard` 認証完了画面のみ）

## 2026-05-21 (staging 待ち) – fix: AI献立フォローアップ修正（遷移先・ヘッダー被り・生成中表示）

- change(app/meal-plan/page.tsx): 記録後の遷移先を `/menu` → `/home`（ホーム）に変更（前回修正3のフィードバック反映）
- fix(app/meal-plan/page.tsx): 結果へのスクロール時に案1カード上端が sticky な PageHeader に潜り込む問題を `scroll-mt-24` で解消
- change(app/meal-plan/page.tsx): 献立生成中は「作り方を見る」と同じく画面下からのボトムシートでローディング（「AI が献立を考えています…」）を表示。結果がいきなり差し替わる違和感を解消。結果表示時のスクロールも `instant` → `smooth` に変更
- 影響範囲: 顧客側（`/meal-plan`）

## 2026-05-21 (staging 待ち) – fix(security): レシピ生成 API を認証必須化

- fix(app/api/meal-plan/recipe/route.ts): `withLiffTenant` でラップし、検証済み LINE ID トークンが無いリクエストを 401 で拒否。従来は認証なしで誰でも叩け、Gemini API コストを外部から無制限に消費可能だった
- 呼び出し元（`app/meal-plan/page.tsx` の `apiFetch`）は既に Bearer トークンを送信済みのためクライアント側変更なし
- 影響範囲: API（`/api/meal-plan/recipe`。顧客の正常利用には影響なし）
- 補足: ログイン済み顧客による連打への rate limit は別タスク（2026-05-19 セキュリティ残タスク）で対応

## 2026-05-21 (staging 待ち) – fix: AI献立3メニュー一覧の初期スクロール位置・レシピモーダルの記録ボタン位置・記録後の遷移先

- fix(app/meal-plan/page.tsx): 結果表示時に `resultTopRef.scrollIntoView` で案1先頭へスクロール（不具合1）
- fix(app/meal-plan/page.tsx): RecipeSheet の記録ボタンを `fixed bottom-0`（viewport 基準で手順に重なる）から `sticky bottom-0`（シート内スクロールコンテナ基準）に変更し手順と重なるレイアウト崩れを解消（不具合2）
- fix(app/meal-plan/page.tsx): 記録完了後に `router.push('/menu')` でメニューページへ遷移（従来は AI献立画面のまま）（不具合3）
- 影響範囲: 顧客側（`/meal-plan`）

## 2026-05-21 (本番) – change: 認証オンボーディング画面でフッターナビ非表示（staging→main 反映）

- change(components/FooterNav): `/onboard`・`/home/onboard` でフッターナビ（ホーム/食事記録/AI相談/メニュー）を非表示に。staging で QA（GO 判定）・オーナー手動確認を経て本番反映
- 招待リンクの LINE 認証完了後（`/home/onboard`）の次アクションを「公式LINE 友だち追加」だけに統一し、フッターからプロダクトへ直行する抜け道を塞ぐ
- 影響範囲: 顧客側（`/onboard`・`/home/onboard` のみ。`/home` 等プロダクト本体のフッターは従来どおり表示）

## 2026-05-20 (本番) – fix: 日別カロリーのツールチップ項目名を「摂取」に

- fix(admin/analysis): 日別カロリーグラフのツールチップ値行が項目名空で「: 3450 kcal」と先頭コロンだけ浮いていたのを、項目名「摂取」を付けて「摂取: 3450 kcal」に修正（当日の摂取カロリーと分かるように）
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`。社長指示により本番直接修正

## 2026-05-20 (本番) – change: 日別カロリーの目標ラベル削除 + 食事一覧にサムネ表示

- change(admin/analysis): 日別カロリーグラフの「目標 N」固定ラベルを削除し、ホバー時のツールチップに「目標 Nkcal」を表示するよう変更（目標線の点線は残す）
- feat(admin/analysis): 食事一覧の各行に食事画像のサムネ（Google Drive サムネ）を表示。画像なしは食事区分アイコンのプレースホルダ
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`。社長指示により本番直接修正

## 2026-05-20 (staging) – change: 認証オンボーディング画面でフッターナビを非表示（プロダクト直行導線を塞ぐ）

- change(components/FooterNav): `/onboard`・`/home/onboard` 配下でフッターナビ（ホーム/食事記録/AI相談/メニュー）を非表示に
- 背景: 招待リンクの LINE 認証完了後の `/home/onboard` 成功画面に共通フッターが出ており、「公式LINE 友だち追加」をせずフッターからプロダクトへ直行できてしまっていた
- 意図する導線: 認証完了 → 公式LINE 友だち追加 → 公式LINE リッチメニューからプロダクトへアクセス。認証後ページの友だち追加ボタンは既存のまま維持
- 影響範囲: 顧客側（`/onboard`・`/home/onboard` のみ。`/home` 等プロダクト本体のフッターは従来どおり表示）

## 2026-05-20 (本番) – fix: 食事記録取得のページネーション欠落（最新日が漏れ集計が不正確になる）

- fix(lib/notion): `getFoodRecordsByDateRange` が 100件で打ち切られ `has_more` を処理していなかったのを、`has_more`/`next_cursor` ループ（最大20ページ）で全件取得するよう修正
- 背景: 日付 昇順ソート + 100件上限のため、記録が100件を超える顧客では最新日付（例 5/19・5/20）が取得から漏れ、日別カロリーが空になるだけでなく平均カロリー・食事バランス等の集計全体が不正確だった
- これが「5/19・5/20 が空」「数値が違う」の真因。先行の Cell 排除・日付キー正規化は副次的な改善で、本件が本丸
- 影響範囲: 顧客分析の全数値（`getFoodRecordsByDateRange` 利用箇所すべて）。社長指示により本番直接修正

## 2026-05-20 (本番) – fix: 日別集計のキーを日付のみに正規化（5/19・5/20 が空になる不具合）

- fix(lib/analysisAggregate): `byDay` の集計キーを `r.date` → `r.date.slice(0,10)` に変更
- 背景: 食事記録の「日付」が時刻付き（datetime, 例 `2026-05-19T08:00:00...`）で保存されると、集計キーが datetime のまま。日別グラフは `YYYY-MM-DD` で日を生成するため突き合わせに失敗し、その日が「記録なし」扱いになっていた（5/19・5/20 が空・値違いの原因）
- 日付のみに正規化して、date 型・datetime 型どちらの記録でも正しく日別集計されるようにした
- 影響範囲: 顧客分析の日別カロリー・食事バランス・AI サマリ（`lib/analysisAggregate.ts` 利用箇所すべて）。社長指示により本番直接修正

## 2026-05-20 (本番) – fix: 日別カロリーグラフのずれを Cell 排除で根絶

- fix(admin/analysis): 日別カロリー棒グラフから `<Cell>`（棒ごとの色分け）を削除し、単色（emerald）に変更
- 背景: 長期間表示で recharts の `<Cell>` 配列が内部データ順とずれ、棒の高さ・色・ツールチップ値が食い違っていた（5/19 が「323kcal」表示なのに灰色で約3600の高さ等）。Cell の key を安定化・再マウント等を試したが解消せず、Cell 自体を排除して根絶
- 目標超過/不足の色分けは失われるが、目標線（ReferenceLine）で超過判定は可能。記録なしの日は棒なし（高さ0）で表現
- 社長指示により本番（main）へ直接修正
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis` の日別カロリーグラフ

## 2026-05-20 (本番) – staging→main マージ: 1食平均・体重目標ライン・週間ラップ・食事一覧

- staging で社長確認済み
- マージ commit: 5a80f8a
- 内容: 食事区分別カロリーを「1食あたり」平均に修正 / 顧客分析に「食事一覧を見る」ボタン追加 / 体重推移グラフに週平均ライン（週間ラップ）追加 / 体重目標ラインの起点を「初回記録日＋開始体重(kg)」に修正
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`、API `/api/admin/customers/[id]/analysis/data`、`lib/analysisAggregate.ts`

## 2026-05-20 (staging) – fix: 体重目標ラインの起点体重を「開始体重(kg)」に修正

- fix(api/admin/customers/[id]/analysis/data): 目標ラインの起点体重を「初回体重記録の実測値」→「顧客プロフィールの開始体重(kg)」に変更
- 背景: 初回体重記録の実測値と開始体重フィールドがズレているケースで、目標ラインが実体重・目標設定（「あと N kg 減量」）と食い違って見えた。起点日は初回体重記録日のまま、起点体重のみ開始体重フィールドに統一
- 補足: 線形補間の計算式自体は正しく、変更なし
- 影響範囲: 顧客分析の体重推移グラフ 目標ライン（`/admin/analysis`・`/store/analysis`）

## 2026-05-20 (staging) – feat: 体重推移グラフに週平均ライン（週間ラップ）を追加

- feat(admin/analysis): 体重推移グラフに、初回記録日を起点に7日ごとに区切った週平均体重のライン（amber, 階段状）を追加。日々の水分変動でギザギザになる生データに対し週単位のトレンドが見える
- 凡例に「週平均」を追加（実体重・週平均・目標）
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis` の体重推移グラフ（期間表示）

## 2026-05-20 (staging) – feat: 顧客分析に食事一覧ボタン追加・体重グラフ目標ライン起点を初回記録日に変更

- feat(admin/analysis): 「食事一覧を見る」ボタンを追加。押下で対象期間の食事記録を日付別グルーピングして一覧表示（食事区分・食事名・kcal・PFC）。ロード中/ゼロ件/エラー状態ハンドリング含む
- fix(admin/analysis): 体重グラフ目標ライン（理想ペース点線）の起点を「オンボーディング完了日＋currentWeight」→「初回体重記録日＋その日の体重」に変更
- change(api/customers/[id]/analysis/data): 全期間体重ログ（`listWeightLogsByLineUser` 引数なし）を追加取得し `target.startDate`・`target.startWeight` を初回体重記録から算出。記録ゼロ時は両フィールド null
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`（体重グラフ目標ライン）、API `GET /api/admin/customers/[id]/analysis/data`

## 2026-05-20 (staging) – fix: 食事区分別カロリーを「1食あたり」平均に修正

- fix(lib/analysisAggregate): `mealTypeCount` を食材レコード数 → 食事区分ごとの記録日数に変更
- 背景: 1食を複数品目に分けて記録するとレコード数が膨らみ、「1品目あたり平均」になって値が過小だった（例: 朝食 96kcal/回）。記録日数を分母にして「1食あたり平均」にする
- 影響範囲: 顧客分析の食事バランス「食事区分別カロリー」（`/admin/analysis`・`/store/analysis`）

## 2026-05-20 (本番) – staging→main マージ: 顧客分析の表示改善ほか一式

- staging で社長確認済み
- マージ commit: 0b23f96
- 内容: 食事区分別カロリーを1回平均に / 平均カロリー・PFC を「実績/目標」形式に / 体重推移グラフに目標ライン追加 / 日別カロリーの顧客切替ずれ再修正 / 数値表記の改善 / 顧客所属店舗 select の旧値フォールバック / AdminShell 右上のちらつき解消・「アドミン」表記
- 影響範囲: 管理画面 `/admin/analysis`・`/admin/customers`（と `/store/*`）、API `/api/admin/customers/[id]/analysis/data`、`lib/analysisAggregate.ts`、`AdminShell`

## 2026-05-20 (staging) – change: PFC・平均カロリーを「実績 / 目標」形式に統一

- change(admin/analysis): PFC チップを「実績 / 目標 g」形式に（例「28.3 / 128.5 g」）。「摂取」「目標」「達成」のラベルを削除し % のみ残す
- change(admin/analysis): 平均カロリーを「実績 / 目標 kcal」形式に（例「1080 / 1500 kcal」）。「目標」ラベルを削除
- 同日先行の「ラベル明示型」から、ラベルなしの分数形式へ再調整

## 2026-05-20 (staging) – change: 顧客分析の数値表記を分かりやすく

- change(admin/analysis): PFC チップを「摂取 28.3g / 目標 128.5g / 達成 22%」のラベル明示型に変更
- change(admin/analysis): 記録日の表記を「3 /20日」→「3日 / 20日間」に変更
- change(admin/analysis): 平均カロリーの目標値（目標 N kcal）を数値の右横に配置
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis` の数値ハイライト

## 2026-05-20 (staging) – feat: 体重推移グラフに目標ラインを追加

- feat(admin/analysis): 期間表示の体重推移グラフ（WeightSection）に「目標ライン」を追加。オンボーディング完了日の開始体重から目標達成日の目標体重へ線形補間した理想ペースを点線で描画
- feat(api/admin/customers/[id]/analysis/data): target オブジェクトに startDate（onboardingCompletedAt の日付部分）を追加
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`（体重グラフ期間表示のみ）、API `/api/admin/customers/[id]/analysis/data`

## 2026-05-20 (staging) – change: PFC チップの目標値を数値の右に配置

- change(admin/analysis): MacroChip の目標値を `{avg}g` の下段から右隣（「28.3g / 目標 128.5g」）へ移動。% は下段に残す
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis` の数値ハイライト

## 2026-05-20 (staging) – fix: 顧客の所属店舗 select に旧値フォールバックと「店舗未設定」ラベルを追加

- fix(admin/customers/[id]): 編集画面で顧客の storeId が stores マスタに存在しない旧値（表記ゆれ等）だった場合、「旧値（旧値）」として select に選択肢を追加し、保存操作で意図せず storeId が消えないように対応
- fix(admin/customers/new, [id]): 所属店舗 select の空値選択肢ラベルを「—」→「店舗未設定」に変更し、未選択状態を明示
- 影響範囲: 管理画面 `/admin/customers/new`・`/admin/customers/[id]`（UI のみ、API 変更なし）

## 2026-05-20 (staging) – feat: 顧客分析UIを3点調整

- feat(admin/analysis): 食事区分別パイチャートを「期間合計kcal」から「1回あたり平均kcal/回」表示に変更。`lib/analysisAggregate.ts` に `mealTypeCount` 集計を追加しAPIレスポンスにも含める。`MealTypePie` が区分別平均を算出し構成比・リスト表示ともに平均ベースに
- feat(admin/analysis): 平均カロリーカード（KcalGauge）から `{pct}%` と判定ラベル（「目標範囲内」「不足ぎみ」「オーバー」）を削除。プログレスバーは残す
- feat(admin/analysis): PFCチップ（MacroChip）に目標絶対値「目標 Ng」を追記（avg・target・%の3段表示）
- 影響範囲: 管理画面 `/admin/analysis`、API `/api/admin/customers/[id]/analysis/data`、`lib/analysisAggregate.ts`

## 2026-05-20 (staging) – fix: 日別カロリーグラフが顧客切替でずれる問題の再修正

- fix(admin/analysis): 日別カロリーグラフの再マウント key に `customerId` を追加
- 背景: 前回修正で key を `rangeLabel`（日付範囲のみ）にしたが、期間が同じまま顧客だけ切り替えると key が変わらず、recharts が前の顧客のグラフ状態（Cell の色対応）を引きずってずれていた
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`

## 2026-05-20 (staging) – fix: 管理画面ヘッダー右上のちらつき + 「アドミン」表記に統一

- fix(admin/AdminShell): ページ遷移のたびに右上のロールバッジが一瞬消えるちらつきを修正。AdminShell はページ毎に個別マウントされ `me` が毎回 null リセットされていたため、module スコープにキャッシュして再マウント時に即描画
- change(admin/AdminShell): `/admin` 右上のバッジを「マスタ」→「アドミン」に変更し、認証フェッチ非依存（`isStore` のみ）で常時表示。`/store` 側は「店舗」のまま
- 影響範囲: 管理画面 `/admin` 全ページのヘッダー

## 2026-05-20 (本番) – staging→main マージ: 日別カロリー修正・運動セクション・食事管理件数・日付ピッカー修正

- staging で社長確認済み
- マージ commit: 5bf71bc
- 内容: 日別カロリーグラフのずれ修正 / 体重・運動セクション分離・運動ログ表示 / 食事管理の顧客セレクトに記録件数併記 / 日付ピッカーの開始日連動バグ修正
- 影響範囲: 管理画面 `/admin/analysis`・`/admin/meals`（と `/store/*`）、API `/api/admin/meals`、共通コンポーネント `DateRangePicker`

## 2026-05-20 (staging) – fix: 日付ピッカーで開始日変更時に終了日が連動するバグ

- fix(admin/DateRangePicker): 単日状態（from===to）で開始日を変更すると `isSingleDay` 分岐で終了日も同じ日に連動し、単日→範囲に広げられなかったバグを修正
- 対応: 開始日変更時は終了日を据え置き、開始日が終了日より後になった場合のみ終了日を合わせる
- 影響範囲: 顧客分析・食事管理の期間ピッカー（`/admin/analysis`・`/admin/meals` ほか DateRangePicker 利用箇所すべて）

## 2026-05-20 (staging) – 食事管理: 顧客セレクトに対象期間の記録件数を併記

- feat(admin/meals): 顧客選択ドロップダウンに対象期間の記録件数を併記（「氏名（5件）」/ 記録ゼロは「氏名（記録なし）」）。どの顧客が記録できているか一目で把握できるようにした
- feat(api/admin/meals): レスポンスに `customerCounts`（顧客別の期間内記録件数。顧客・食事区分フィルタ前の全件で集計）を追加
- 影響範囲: 管理画面 `/admin/meals`・`/store/meals`、API `/api/admin/meals`

## 2026-05-20 (staging) – 顧客分析: 日別カロリーグラフ修正 + 体重/運動セクション分離

- fix(admin/analysis): 日別カロリー棒グラフで長期間表示時に棒の高さ・色・ツールチップ値がずれるバグを修正
  - 原因: XAxis の dataKey が短い `M/D` 文字列で長期間に重複、Cell の key が配列 index でデータ本数変化時に対応がずれていた
  - 対応: XAxis を一意な `YYYY-MM-DD` キー＋tickFormatter 表示に、Cell の key を日付ベースに、グラフを期間変更で再マウント、アニメーション無効化
- change(admin/analysis): 体重と運動を別セクションに分離
- feat(admin/analysis): 運動セクションを「いつ・何を」のログ表示に変更（全体サマリ＋種目別集計＋日付順の記録リスト。旧: 日別消費kcal 棒グラフ）
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`

## 2026-05-20 (本番) – staging→main マージ: 顧客分析ページ大改修 + 体重ログフィルタ修正

- staging で社長確認済み（顧客分析ページ6点改修 + 体重ログ 400 エラー修正）
- マージ commit: 4bf7dd2
- 内容: 「AI 分析」→「顧客分析」改称 / グラフ常時表示・AI サマリ分離 / 店舗フィルタ / 単日デフォルト / 体重・運動記録セクション / 食事バランスグラフ修正 / 体重ログ Notion フィルタ型バグ修正
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`、API（新規 `analysis/data` 1本・既存 `analysis` 縮小）、`lib/analysisAggregate.ts`・`lib/repository/weightLogs.ts`

## 2026-05-20 (staging) – fix: 体重ログ取得の Notion フィルタ型エラー

- fix(lib/repository/weightLogs): `listWeightLogsByLineUser` が体重DBの「日付」（Notion title 型）に date 型用フィルタ `on_or_after`/`on_or_before` を指定し Notion API 400 を返していたバグを修正
- 対応: lineUserId のみで全件取得し、日付範囲は JS 側（文字列比較）で絞り込む方式に変更
- 背景: 顧客分析ページ大改修の data API が体重ログを日付範囲付きで取得して初めて顕在化した既存バグ。社長の staging 動作確認中に発覚
- 影響範囲: 顧客分析ページの体重・運動セクション（`/admin/analysis`・`/store/analysis`）
- 補足: 運動ログ (`exerciseLogs.ts`) は「日付」が date 型で `date:` フィルタを正しく使用しておりバグなし

## 2026-05-20 (staging) – 顧客分析ページ大改修

- change(admin/AdminShell): タブ label「AI 分析」→「顧客分析」
- feat(admin/analysis/page): グラフ常時表示（顧客+日付確定で data API 自動フェッチ）・AI サマリ分離（「AI でサマリ作成」ボタン）
- feat(admin/analysis/page): 店舗フィルタ追加（顧客 select の上に店舗 select、絞り込み連動）
- change(admin/analysis/page): 初期表示を単日（today）に変更
- feat(admin/analysis/page): 体重・運動記録セクション追加（単日=詳細リスト、期間=折れ線/棒グラフ）
- fix(admin/analysis/page): MealTypePie のサイズを w-32/innerRadius 32/outerRadius 56 に統一（PfcPie と対称化）
- feat(lib/analysisAggregate): 集計ロジックを共通モジュールとして抽出（from/to 日付範囲対応）
- feat(api/admin/customers/[id]/analysis/data): 新 GET API（DB データのみ返却、AI 呼び出しなし）
- change(api/admin/customers/[id]/analysis): POST API を AI サマリ専用に縮小、from/to パラメータ対応追加
- fix(lib/analysisAggregate): `normalizeRange` で期間を最大366日にクランプ＋不正日付フォールバック（Notion レート制限・タイムアウト対策）
- fix(admin/analysis/page): data フェッチに AbortController を導入し、日付シフト連打時の古いレスポンス上書き（race condition）を解消
- 影響範囲: 管理画面 `/admin/analysis`・`/store/analysis`、API 2本（新規1本・既存縮小1本）
- レビュー: code-reviewer 実施。残課題=運動DB (`lib/repository/exerciseLogs.ts`) がテナント非スコープ（既存問題・現状シングルテナントで実害なし・別途対応）

## 2026-05-20 (本番) – Notion 開始体重リネーム Phase 4: 読み込みフォールバック削除

- chore(lib/notion): `parseCustomerFromPage` の読み込みを `p['開始体重(kg)']?.number ?? null` に単純化（旧名「現在体重(kg)」フォールバックを削除）
- 前提: 本番/staging 双方の Notion 顧客 DB が「開始体重(kg)」にリネーム済み、書き込み・読み込み・UI すべて新名で運用安定確認済み
- 影響範囲: `lib/notion.ts`（バックエンド読み込みのみ）。CLAUDE.md ルール 4 に基づき main 直 push。動作変化なし

## 2026-05-20 (staging) – /admin UI ラベル「現在体重」→「開始体重」統一

- change(admin/page): 顧客リストの体重表記 `現在 78kg → 目標 58.4kg` を `開始 78kg → 目標 58.4kg` に変更
- change(admin/customers/[id]): 編集画面の身体情報セクション、`NumberInput label="現在体重"`・注釈・コメントを「開始体重」に統一
- change(admin/customers/new): 新規追加画面の身体情報、`NumInput label="現在体重"`・注釈を「開始体重」に統一
- change(admin/templates): テンプレ変数 `{weight}` の表示ラベルを「現在体重」→「開始体重」に変更
- 背景: Notion フィールド名を「現在体重(kg)」→「開始体重(kg)」にリネーム済み。UI 表示も意味を揃える
- 影響範囲: 管理画面のラベル表示のみ。データ・API 動作は変化なし

## 2026-05-20 (本番) – テンプレ管理画面の UI 統一（戻る矢印削除・名称統一）

- fix(admin/templates): ヘッダーの戻る矢印 (`back` prop) を削除し、他の管理画面と UI を統一
- change(admin/templates): ページタイトル「レポートテンプレート管理」→「テンプレ管理」
- change(admin/AdminShell): タブナビのラベル「テンプレ」→「テンプレ管理」
- change(admin/reports): レポート送付ページ内のリンク「⚙ レポートテンプレート管理」→「⚙ テンプレ管理」
- 影響範囲: 管理画面 `/admin/templates`・`/store/templates`・`/admin/reports`・`/store/reports`（社長のみアクセス）。CLAUDE.md ルール 4 に基づき main 直 push

## 2026-05-20 (staging) – Notion 開始体重リネーム Phase 4: 読み込みフォールバック削除

- chore(lib/notion): `parseCustomerFromPage` の読み込みを `p['開始体重(kg)']?.number ?? null` に単純化（旧名「現在体重(kg)」フォールバックを削除）
- 前提: 本番/staging 双方の Notion 顧客 DB で「開始体重(kg)」リネーム済み、書き込みも新名に切り替え済み・運用安定確認済み
- 影響範囲: バックエンド読み込みのみ。動作変化なし（同じ DB に対してフォールバック側が呼ばれることはもう無い）

## 2026-05-20 (本番 hotfix) – 解約予約判定に `cancel_at` も含める

- fix(api/admin/billing/info): `cancelAtPeriodEnd` を `sub.cancel_at_period_end || !!sub.cancel_at` に変更
- 背景: Stripe Customer Portal でトライアル中に解約予約すると `cancel_at_period_end` は false のまま `cancel_at` に解約日が入るだけ。`cancel_at_period_end` だけで判定していたため本番で解約予約バナーが表示されなかった
- 影響範囲: 管理画面 `/admin/billing`・`/store/billing`（社長のみアクセス）。CLAUDE.md ルール 4 に基づき main 直 push
- 動作確認: 修正後、本番 `/api/admin/billing/info` のレスポンスで `cancelAtPeriodEnd: true` になること、画面に解約予約バナーが出ること

## 2026-05-20 (本番) – staging→main マージ: 契約画面に解約予約状態を表示 + プロフィール画面を読み取り専用へ戻し

- staging で社長確認済み（解約予約バナー / 「解約予定日」表示 / プロフィール読み取り専用化）
- マージ commit: 81e3acd（feature commit 5bc2b07）
- Stripe Dashboard 側: トライアル7日前 / 有効期限が近いカード / カード決済失敗 / 決済手段の更新「Stripe 上のページにリンク」/ サブスクリプション管理リンク を社長作業で ON 済み
- 影響範囲: 顧客側 LIFF `/profile`、管理画面 `/admin/billing`・`/store/billing`、API `/api/admin/billing/info`

## 2026-05-20 (staging) – 契約画面に解約予約状態を表示 + プロフィール画面を読み取り専用へ戻し

- feat(admin/billing): Stripe Subscription の `cancel_at_period_end` を `/api/admin/billing/info` で取得し、解約予約中であることを契約画面に表示（黄色バナー、「支払いステータス: 解約予約中」、「次回請求日 → 解約予定日」）
- 背景: トライアル中に Stripe Portal から解約しても画面上は「お試し」「次回請求日」のままで、解約手続きが完了したかオーナーが判別できなかった（Stripe Webhook は `cancel_at_period_end` を見ていない）
- revert(liff/profile): 顧客側プロフィール画面の自己編集機能（氏名・性別・身長・体重・生年月日の入力フォーム＋保存ボタン）を削除し、`/goals` と同じスタイルの読み取り専用 UI に戻す
- 設計判断: 修正はトレーナーが Notion で実施するルール（[[feedback_liff_customer_role]]）を再徹底。`PATCH /api/customer/me` 自体は他経路（onboarding 等）で利用中のため温存
- 影響範囲: 管理画面 `/admin/billing`・`/store/billing`、API `/api/admin/billing/info`、顧客 LIFF `/profile`
- 補足: Stripe 側からの解約確認メールは Dashboard → Settings → Billing → Customer portal の Email 通知設定でオン（社長作業）



- fix(lib/notion): `createCustomer` の書き込みを「開始体重(kg)」に切り替え（旧名「現在体重(kg)」を廃止）
- fix(lib/notion): `updateCustomer` の書き込みを「開始体重(kg)」に切り替え
- 前提: 本番 Notion 顧客 DB のカラム名を「現在体重(kg)」→「開始体重(kg)」にリネーム済み（2026-05-20）
- 影響範囲: API 経由の顧客新規登録／プロフィール体重更新。読み込みは引き続きフォールバック実装で旧名にも対応中（後日削除予定）
- 関連: `FOLLOWUP_RENAME_NOTION.md`（このコミットで完了）

## 2026-05-20 (staging) – フリガナ機能を全削除

- remove(liff/profile): プロフィール画面のフリガナ入力フィールド削除
- remove(api): `PATCH /api/customer/me` から furigana 受付ロジック削除
- remove(lib/notion): `Customer` 型から `furigana` フィールド、`parseCustomerFromPage` の読み込み、`updateCustomer` の書き込みロジックを削除
- 設計判断: フリガナは本番運用で必要なしと判断（業務フローで利用していない）
- 影響範囲: 顧客側 LIFF `/profile`、API `/api/customer/me`、`lib/notion.ts`（Notion DB 側の「フリガナ」カラム自体は触らず、使われない状態で放置）

## 2026-05-20 (staging) – Notion フィールドリネーム準備: 現在体重→開始体重 フォールバック対応

- fix(lib/notion): `parseCustomerFromPage` の読み込みを新名「開始体重(kg)」優先・旧名「現在体重(kg)」フォールバックに変更
- fix(lib/notion): `createTenantCustomerDb` のスキーマ定義を「開始体重(kg)」に変更（新規テナント向け）
- 書き込み箇所（createCustomer/updateCustomer）は Notion DB リネーム後に別コミットで切り替え予定
- 影響範囲: lib/ のみ（顧客 LIFF・管理画面の表示ラベルは変更なし）
- 関連: FOLLOWUP_RENAME_NOTION.md（リネーム後の作業チェックリスト）

## 2026-05-20 (本番) – staging→main マージ: フリガナ顧客編集 + アカウント削除を管理画面側へ

- feat(liff/profile): フリガナを顧客自身が編集できるように変更（読み取り専用 → 入力フィールド）
- feat(api): `PATCH /api/customer/me` に `furigana` フィールドのサポートを追加
- fix(lib/notion): `updateCustomer()` の patch 型に `furigana` を追加
- remove(liff/profile): プロフィール最下部のアカウント削除セクションを削除（顧客自己削除をやめる）
- remove(liff/home): 非進行中ステータス案内画面の「アカウント削除はこちら」リンクを削除
- feat(admin/customers/[id]): 管理画面の顧客詳細最下部に「アカウント削除」セクション追加（赤系UI、確認ダイアログ付き）
- feat(api): `DELETE /api/admin/customers/[id]` エンドポイント新規（archiveCustomer を呼ぶ）
- feat(lib/repository/customers): `archiveCustomer()` を Notion 実装からエクスポート
- feat(liff/home): 非進行中ステータス案内を「食事管理対象外、またはステータスが進行中ではありません」に統一、中央カード型レイアウトに改善
- fix(liff/goals): 開始体重（currentWeight）表示を復元（進捗バーは非表示維持）
- 影響範囲: 顧客側 LIFF `/profile` `/home` `/goals`、管理画面 `/admin/customers/[id]`、API 複数

## 2026-05-19 21:30 (本番) – 設定中14日経過の自動削除 + 「招待未送信」フィルタ削除

- feat(cron): `/api/cron/customers-cleanup` 新規作成。毎日 03:00 (JST) に全テナント横断で 設定中 + LINE未連携 + 14日経過 顧客を自動アーカイブ化
- chore(vercel.json): customers-cleanup cron をスケジュール `0 18 * * *` (UTC) = 03:00 JST で登録
- fix(admin): 「招待未送信」フィルタを削除（`設定中` フィルタと実質同じだったため整理）
- fix(admin): 14日経過バナーの文言を「自動削除されます」に変更、手動削除ボタンを「今すぐ一括削除」に改名
- feat(admin/customers/new): 顧客作成成功画面の InvitePanel に「14日ルール（招待未利用なら自動削除）」の警告ブロックを追加
- 影響範囲: 管理画面顧客一覧、新規顧客追加フォーム、cron 1本追加

## 2026-05-19 – 設定中顧客クリーンアップ機能 4点

- feat(admin/page): ステータスフィルタに「招待未送信」追加（foodStatus=設定中かつ lineUserId なし）
- feat(admin/page): 14日以上未起動の設定中顧客件数バナーを上部に追加（0件時は非表示）
- feat(api): `POST /api/admin/customers/bulk-cleanup` — 設定中14日経過顧客を Notion アーカイブ
- feat(admin/page): 一括削除ボタンをバナー内に配置（確認ダイアログ付き）
- feat(admin/customers/new): 顧客追加成功後に招待リンク主CTA 画面を表示（コピー・LINE送信ボタン付き）
- fix(lib/notion): Customer 型に `createdTime` フィールド追加、`parseCustomerFromPage` で `page.created_time` を読む
- fix(lib/notion): `archiveCustomer()` 関数追加（PATCH /pages/:id archived:true）
- fix(lib/repository/customers): `archiveCustomer()` エクスポート追加
- 影響範囲: 管理画面のみ（顧客 LIFF 側は無変更）

## 2026-05-19 21:15 (本番) – 席数カウントを「進行中」のみに変更

- change(seats): seat カウント対象を「進行中」顧客のみに変更（設定中・休止中・卒業は除外）
- change(billing UI): 注記文言を「『進行中』の顧客のみ席数カウント対象」に変更
- 設計意図: ジムの業務フロー（入会面談→仮登録→正式入会）に合わせ、設定中は seat を消費しない
- リスク許容: 大量「設定中」放置の課金逃れリスクは限定的と判断。問題が出たら「設定中の総数上限」を追加で対応

## 2026-05-19 21:00 (本番) – 席数カウントから「休止中」「卒業」顧客を除外

- feat(seats): 初版実装（休止中・卒業のみ除外）。21:15 に「進行中のみ」へ変更

## 2026-05-19 20:45 (本番) – 解約済み状態の UI 改善

- fix(billing): `hasContract=false` かつ `hasStripeCustomer=true`（過去契約あり）の場合、「現在の契約」セクションを非表示にして新規契約フォームのみ表示
- feat(billing): 新規契約フォームの下に「過去の請求履歴を見る」リンクを追加（Stripe Portal へ）
- fix(webhook): `customer.subscription.deleted` で `nextBillingDate` を null クリア
- 影響範囲: `/store/billing` `/admin/billing` の UI、Stripe Webhook
- 関連: 解約済みなのに「次回請求日: 2026-06-16」など矛盾表示が出ていた問題

## 2026-05-19 20:30 (本番) – Stripe Volume Pricing に移行（per-user 単一 Price 化）

- refactor(stripe): per-user 価格を Stripe Volume Pricing 1 つの Price に集約。3-20名/21-50名/51名+ の tier 単価は Stripe 側で自動計算
- env: `STRIPE_PRICE_STARTER/GROWTH/SCALE_PER_USER` を `STRIPE_PRICE_PER_USER` 1 本に集約。本番 env も更新済み
- refactor(stripe.ts): `getPerUserPriceId()` 新規追加、`getPriceIdForTier()` は後方互換ラッパーに（tier 無関係に単一 Price を返す）
- refactor(checkout/update-seats/preview-seats/webhook): 単一 Price 前提に書き換え、旧 tier ベース env は移行期フォールバックとして残す
- 影響範囲: 顧客側 Stripe Checkout フロー、`/admin/billing` 席数変更モーダル、Stripe Customer Portal での席数変更（同時に有効化予定）
- 利点: tier 自動切替により Customer Portal で席数変更が完結可能に。アプリ側 SeatChangeModal は保険として維持

## 2026-05-19 19:15 (本番) – Stripe Webhook イベント順序問題の修正

- fix(stripe/webhook): `customer.subscription.created` が `checkout.session.completed` より先に到着した場合、Notion に Customer ID が未登録のため tenant 解決に失敗し、`支払いステータス` `席数` `プラン種別` が更新されない問題を修正
- fix(stripe/webhook): `handleCheckoutCompleted` で Customer ID 登録後に subscription を retrieve して `handleSubscriptionUpdate` を明示的にトリガー
- fix(stripe/webhook): `handleSubscriptionUpdate` で customer ID 解決失敗時、`sub.metadata.tenantId` でフォールバック検索
- 影響範囲: Stripe Checkout 完了後の Notion テナント DB 自動更新

## 2026-05-19 19:00 (本番) – /store/billing UX 改善 + 14日無料トライアル追加

- feat(billing): Stripe Checkout に 14日間の無料トライアル `trial_period_days: 14` を追加
- feat(billing): 「無料で14日間試す（カード登録）」ボタン文言に変更、トライアル説明バナー追加
- fix(billing): 席数入力の初期値を常に `MIN_SEATS=3` に固定（旧: 現在の顧客数まで自動増加 → 9 で初期表示されていた）
- fix(billing): プランカードを「席数で自動判定」と明示。点線ボーダー＋低彩度で非クリック視覚化、適用中の tier に「適用中」バッジ
- fix(seats): トライアル中（paymentStatus='お試し'）も `hasContract=true` 判定に含める（招待ブロック等が正しく動くように）
- 影響範囲: 管理画面 `/store/billing` `/admin/billing` UI、Stripe Checkout 動作

## 2026-05-19 18:30 (本番) – FitMeal 料金を Stripe 本番Priceに合わせて税込統一

- fix(stripe): `SUPPORT_FEE` 5,000→5,500、Starter 2,500→2,750、Growth 2,000→2,200、Scale 1,500→1,650 に変更（Stripe Liveで税込登録されたPriceに合わせる仮対応）
- fix(admin/billing): プラン比較カード・サポート費表示・SeatChangeModal の見積もりを税込に統一。「税込」注記追加
- 影響範囲: 管理画面 `/store/billing` `/admin/billing`、Stripe Checkout 見積もり整合性
- 関連: 2026-05-19 朝 Stripe Live モード切替後、Checkout で UI 表示(¥17,500)と請求金額(¥19,250)が乖離していた問題への対応

## 2026-05-19 (staging) – /profile 401 修正・/goals 有効化

- fix(profile): `fetch` を `apiFetch` に差し替え。Authorization ヘッダーが送られず 401 になっていた不具合を修正
- fix(goals): `window.location.href = '/home'` による即時リダイレクトを削除。`fetch` → `apiFetch` に変更
- feat(menu): 「目標設定」の `disabled` を解除し `/goals` へのリンクを有効化。読み取り専用（トレーナー設定値の表示のみ）
- 影響範囲: 顧客側 LIFF `/profile` `/goals` `/menu`（staging のみ）

## 2026-05-19 (staging) – OnboardingTour リセット後の再表示バグ修正

- fix(OnboardingTour): `tourResetAt=undefined`（APIロード前）の初期状態で `isDone=true` と誤判定し、ツアーが再表示されないバグを修正
- fix(OnboardingTour): `useEffect` の早期リターン条件として `tourResetAt === undefined` を追加。API取得完了後（null or ISO文字列確定後）にのみ表示判定を行う
- fix(OnboardingTour): `isDone` 判定の `tourResetAt === undefined` 分岐を削除（上記ガード後は undefined が到達しないため）
- 影響範囲: 顧客側 LIFF `/record` `/weight` `/exercise`（staging のみ）

## 2026-05-19 (staging) – /record オンボツアー全面再構成＋UI配置変更

- feat(record/tour): オンボツアーを4ステップ→6ステップに再構成（record-date / record-photo-group / record-fooddb / record-mymenu / record-text / record-no-meal）
- feat(record/ui): グリッドの並び順変更：写真を撮る・画像から選ぶ・成分表を撮る が連続する配置に（旧：写真/画像/マイメニュー/食品DB/成分表/テキスト → 新：写真/画像/成分表/食品DB/マイメニュー/テキスト）
- feat(record/ui): 写真3ボタンを `record-photo-group` wrapper div でまとめ、ツアーがグループ全体をハイライト可能に
- feat(record/ui): 日付セレクタに `data-tour="record-date"` 付与
- feat(record/ui): マイメニューに `data-tour="record-mymenu"` 付与
- feat(record/ui): 「食べなかった」ボタンに `data-tour="record-no-meal"` 付与
- 影響範囲: 顧客側 LIFF `/record`（staging のみ）

## 2026-05-19 – staging→main マージコンフリクト解決

- merge: staging と main の 13 ファイルコンフリクトを解決し PR #17 の自動マージ準備
- 影響範囲: 全ファイル（コンフリクト解決のみ、機能変更なし）

## 2026-05-19 (staging) – オンボーディングリセット 500 エラー修正

- fix(admin/onboarding): DELETE `/api/admin/customers/[id]/onboarding` が 500 を返す問題を修正
- 原因: staging の Notion 顧客 DB に「ツアーリセット日時」列が存在しない場合、`patchCustomer` が Notion 400 を受けて例外を throw し、`withAdminTenant` が 500 を返していた
- 修正: route.ts で `onboardingCompletedAt` と `tourResetAt` の同時書き込みを try/catch でラップ。失敗時は `onboardingCompletedAt: null` のみで確実にリセットし、`tourResetAt` は単体書き込みを試みてエラーでも 500 にしない
- 診断強化: `withAdminTenant` の catch に `console.error` を追加し Vercel ログにエラー詳細を出力
- 影響範囲: 管理画面 / `app/api/admin/customers/[id]/onboarding/route.ts`、`lib/withTenant.ts`

## 2026-05-19 (staging) – 体重・運動保存の楽観的 UI 更新

- perf(home): `WeightExerciseCard` の `onSaved` コールバックに保存値 (`WeightExerciseUpdate`) を渡すよう変更
- perf(home): `LiffGate.tsx` の `handleWeightUpdated` を楽観的更新に変更。POST 成功と同時に `setData` で即時反映し、バックグラウンドで `/api/extras` を再取得して整合性同期
- perf(history): `app/history/page.tsx` の `onUpdated` も同様に楽観的 `setDayExtras` + `reloadKey` バックグラウンド同期に変更
- 影響範囲: 顧客側 / `components/WeightExerciseCard.tsx`、`app/home/_components/LiffGate.tsx`、`app/history/page.tsx`
- トレードオフ: `/api/extras` バックグラウンド fetch が完了する前後で一瞬表示値が変わり得るが、POST 成功後に正確な値が届くため視覚的不整合は 1〜2 秒以内に解消

## 2026-05-19 (staging) – Phase 3 staging バグ修正 5 件（うち 1 件は既知のため別途）

- fix(Bug1/home): LiffGate.tsx のクイックアクション「AI食事相談」「AI献立作成」が絵文字になっていた問題を修正。lucide-react の `MessageCircle` / `ChefHat` アイコン JSX に戻した
- fix(Bug2/history): `app/history/page.tsx` の bare fetch 2 箇所（`/api/history`・`/api/day`）を `apiFetch` に置換。Authorization ヘッダーが付与されず 401 になっていた
- fix(Bug3/notifications): `app/api/notifications/route.ts` の catch ブロックに `console.error` を追加して 500 エラーの詳細をログ出力するよう強化
- fix(Bug4/home): `handleWeightUpdated` を optimistic update に変更。保存後に `/api/today`（重い）+ `/api/extras` の2連打から `/api/extras` のみの軽量再取得に絞り、体重・運動保存完了までの待ち時間を短縮
- skip(Bug5/exercise): 運動記録が表示されない件は staging テナント Notion 設定起因の既知課題。コードレベルでは対処せず、社長が staging テナント設定を見直す別タスク扱い
- 影響範囲: 顧客側 / `app/home/_components/LiffGate.tsx`、`app/history/page.tsx`、`app/api/notifications/route.ts`

## 2026-05-19 (staging) – /record ツアー再表示バグ修正 + スキップボタン削除

- fix(onboarding): オンボリセット API (`DELETE /api/admin/customers/[id]/onboarding`) で `tourResetAt` を現在時刻で更新するよう修正。従来は `onboardingCompletedAt: null` のみで localStorage の `fitmeal_tour_record_done` キーより新しい値がセットされず、ツアーが再起動しなかった。
- fix(onboarding): `OnboardingFlow.tsx` のスポットライト表示時（step 2/3/5/6）に右上に絶対配置していた「スキップ」ボタンを削除。ポップ内の `×` ボタンで閉じる動線のみ残す。
- fix(onboarding): `StepPhotoHint` (step 4) のボタン行の「スキップ」テキストを `×` アイコンに統一。
- 影響範囲: 顧客側 `/record` ツアー・`OnboardingFlow.tsx` / API `admin/customers/[id]/onboarding`

## 2026-05-19 (staging) – Phase 3: /home Server Component化・ファイル分割

- refactor(home): `app/home/page.tsx` を Server Component に変更（`'use client'` 削除）
- refactor(home): `<Suspense>` で `<LiffGate />` を wrap する構成に変更（`app/home/page.tsx` はシェル、LIFF ロジックは client side に集約）
- feat(home): `app/home/loading.tsx` を追加（Next.js ルートレベルローディング UI）
- refactor(home): `app/home/_components/` 以下に 8 コンポーネントを分割
  - `types.ts`: `MealRecord` / `TodayData` / `PredictionData` 型定義を集約
  - `LiffGate.tsx`: LIFF init + 全データ fetch + 子 props 渡し（既存 HomePageInner 相当）
  - `DateStrip.tsx`: 日付横スクロールナビ（client）
  - `BadgeModal.tsx`: ドラッグシート式バッジモーダル（client）
  - `NutritionSummaryCard.tsx`: 栄養サマリーカード（pure render）
  - `PredictionBlock.tsx`: AI体重予測ブロック（client、loading state あり）
  - `GoalProgressCard.tsx`: 体重目標進捗 + PredictionBlock を内包（pure render）
  - `MealListSection.tsx`: 食事種別カードリスト（client）
  - `QuickActions.tsx`: クイックアクション3ボタン（Link のみ）
  - `StreakCard.tsx`: 連続記録バッジカード（pure render）
- note: LiffGate 方式のため streaming 効果はなし（LIFF SDK client 専用のため）。Phase 3c の Prediction Suspense island は今後の追加予定
- note: 外見・操作感・API 呼び出し経路は既存と完全同一
- 影響範囲: 顧客側 / `app/home/*`

## 2026-05-19 (staging) – オンボーディング3点修正

- fix(onboarding): `complete()` を `markOnboarded()` + `skip()` に分離し、`await apiFetch(...)` で onboarding API 完了を待ってから遷移するよう修正（fire-and-forget でリクエストキャンセルされていたリグレッション解消）
- feat(onboarding): ホームオンボ最終ステップ（StepComplete）の「次へ」ボタンで `markOnboarded()` await → `/record` に `router.push` するよう変更し、食事記録ツアーへシームレスにつなげる
- feat(onboarding): スキップ系ボタンは `skip()` （markOnboarded → /home）、「次へ」完了系は `next()` → `/record` に分離
- note(onboarding): `/record` ツアーが出ない場合は LINE アプリのキャッシュ or `localStorage.removeItem('fitmeal_tour_record_done')` で解消
- 影響範囲: 顧客側 / `components/OnboardingFlow.tsx`

## 2026-05-19 – Notion クエリキャッシュ統一（テナント分離 key）

- perf(cache): `lib/notion.ts` のインメモリ `customerCache` Map を削除し `lib/cache.ts` に統一
- perf(cache): `getCustomerByLineId` を `${tenantId}:customer:${lineUserId}` key（30 分 TTL）でキャッシュ、`opts.force` でバイパス可
- perf(cache): `getFoodRecordsByDate` / `getFoodRecordsByDateRange` を `${tenantId}:foodRecords:*` key（2 分 TTL）でキャッシュ
- perf(cache): `lib/notion.ts` に `notionFetch(apiKey)` ヘルパー追加（`'use cache'` 将来対応の下準備）
- fix(cache): `updateCustomer` / `updateFoodRecord` / `deleteFoodRecord` / `saveFoodRecord` の書き込み後に `invalidate(prefix)` を呼んで対応キャッシュを即時無効化
- fix(cache): `parseCustomerFromPage` ヘルパーに共通化し `parseCustomerPage` の重複を排除
- note: Next.js 16 の `'use cache'` は `cacheComponents: true` 必須かつ `dynamic = 'force-dynamic'` と非互換のため今回は見送り。既存インメモリキャッシュの品質改善に留める
- 影響範囲: バックエンド API のみ（顧客側 LIFF UI 変更なし）

## 2026-05-19 (staging) – ツアーリセット機能（LIFF 側）

- feat(tour-reset): 管理画面「ツアーをリセット」ボタンと連動する LIFF 側実装
  - `lib/notion.ts`: `parseCustomerPage`・`updateCustomer` に `ツアーリセット日時` 読み書きを追加
  - `lib/repository/customers.ts`: `CustomerPatch` に `tourResetAt` フィールドを追加
  - `components/OnboardingTour.tsx`: `tourResetAt` prop 追加、localStorage のタイムスタンプと比較してリセット判定
  - `app/record/page.tsx`: LIFF 初期化後に `/api/customer/me` から `tourResetAt` を取得して `OnboardingTour` に渡す
  - `app/weight/page.tsx`: 同上
  - `app/exercise/page.tsx`: 同上
- 影響範囲: 顧客側 LIFF（/record, /weight, /exercise）
- 関連: 管理画面側の実装は main ブランチに実装済み（2026-05-19）

## 2026-05-19 (staging) – 食事記録ページ ツアー data-tour 属性補完

- fix(onboarding): `record-photo`（写真を撮る）・`record-fooddb`（食品DB）・`record-text`（テキストで記録）カードに data-tour 属性が欠落していた問題を修正
- fix(onboarding): HubButton コンポーネントに `data-tour` prop を追加して button 要素に伝達
- 影響範囲: 顧客側 / 食事記録ページ初回ツアー step 1〜3

## 2026-05-19 (staging) – Security Critical 再着手 + 漏れ修正 + onboarding tour 拡張

- security(Critical): LIFF lineUserId 自己申告なりすまし防止を staging に再適用（前回 revert 後の漏れ追補込み）
  - lib/withTenant.ts に LINE Verify API 検証組込み（aud検証 / 5分LRUキャッシュ / 503・401分岐 / channel ID は `NEXT_PUBLIC_LIFF_ID` プレフィックス抽出）
  - LIFF API 全 20 ルートを `withLiffTenant` でラップ、`lineUserId` 自己申告排除（検証済み `sub` を使用）
  - `/api/delete` `/api/record/update` に pageId テナント境界チェック追加（Notion 親 DB 照合）
  - `lib/apiFetch.ts` 新規 + 401 自動リトライ（`refreshLiff` で IDトークン期限切れ対策）
  - LIFF 全 13 page + `components/OnboardingFlow.tsx` + `components/WeightExerciseCard.tsx` で `apiFetch` 化
  - 前回 staging 検証で社長検出した追加漏れの修正:
    - `app/meal-detail/page.tsx:131` の `fetchData()` の `/api/today` 呼び出し (= **「食事編集 401」の真の原因**、編集後の再読み込み)
    - `app/prediction/page.tsx:58, 82` の `/api/today` と `/api/predict-weight`
    - `app/home/page.tsx:245` の `/api/predict-weight`
    - `components/OnboardingFlow.tsx:102` の `/api/customer/onboarding`
- onboarding(ui): 同時に staging 上で onboarding tour 拡張作業を含む（社長作業）
  - `OnboardingFlow.tsx` に step 5（体重）・step 6（運動）を追加し全 7 ステップ化、スポットライト対応
  - `app/exercise/page.tsx` に `OnboardingTour` 統合（運動入力ガイド）
  - `app/record/page.tsx` に `OnboardingTour` 統合（食事記録ガイド）
  - `app/weight/page.tsx` に `OnboardingTour` 統合（体重入力ガイド）
- 影響範囲: 顧客側 LIFF 全般 / 管理画面への影響なし
- 関連: 2026-05-19 staging revert (`0d781e8 → 0cc8bdc force update`) からの再着手
- 既知の残課題: `/api/extras` 経由で「運動表示が消える」（テナント切替で個人シート読み取り失敗の可能性）— staging テナントの Notion 設定と GAS 連携先を別途確認要
## 2026-05-19 Security(High): W1/W2/W4/W6 セキュリティ High 一括修正

- security(W1): CRON_SECRET fail-open 修正。`lib/cronAuth.ts` に共通ヘルパー切り出し。本番で未設定なら 503、非本番は警告ログのみ。両 cron route で使用
- security(W2): `lib/inviteToken.ts` — `INVITE_TOKEN_SECRET` 未設定時に `console.error` で鍵共有リスクを警告。動作を壊さずフォールバック維持（後で専用 env 設定推奨）
- security(W4): `lib/withTenant.ts` — `FITMEAL_TENANT_ID_OVERRIDE` を `NODE_ENV !== 'production'` 時のみ参照。本番で override が誤設定されてもテナント固定されない
- security(W6): `next.config.ts` にセキュリティヘッダー追加（全パス対象）。`X-Content-Type-Options` / `X-Frame-Options: SAMEORIGIN` / `Referrer-Policy` / `HSTS` / `Permissions-Policy`（camera 許可）/ `Content-Security-Policy-Report-Only`（まず様子見）
- 影響範囲: `lib/cronAuth.ts`（新規）/ `lib/inviteToken.ts` / `lib/withTenant.ts` / `next.config.ts` / `app/api/cron/daily-reports/route.ts` / `app/api/cron/update-calibrations/route.ts`
- 顧客側 UI への影響なし

## 2026-05-19 feat: admin/store 顧客詳細画面にツアーリセットボタン追加

- feat: `/admin/customers/[id]` と `/store/customers/[id]` にツアーリセットボタンを追加（オンボーディングリセットと横並び）
- 影響範囲: 管理画面 / API / DB（Notion `ツアーリセット日時` 列新設予定）
- 仕組み: `POST /api/admin/customers/[id]/tour-reset` が Notion の `tourResetAt` を現在時刻で更新。LIFF 側（`/record` `/weight` `/exercise`）は起動時に `/api/customer/me` から `tourResetAt` を取得し、localStorage の完了タイムスタンプと比較して古ければツアーを再表示（staging 側で実施）

## 2026-05-19 Security(Critical): LIFF lineUserId 自己申告なりすまし防止

- security(Critical): LIFF API ルート群が body/query の `lineUserId` を無検証で信頼していたバグを修正。任意の userId を送れば他人の食事記録・体重ログ・通知を読み書き削除できる状態だった
- 修正方針: `liff.getIDToken()` をサーバーで LINE Verify API (`https://api.line.me/oauth2/v2.1/verify`) 経由で検証し、検証済み `sub` を `verifiedLineUserId` として handler に注入
- 実装:
  - `lib/withTenant.ts` に LINE IDトークン検証ロジック組込み（`aud` 検証 / 5分LRUキャッシュ / 503・401分岐 / channel ID は `NEXT_PUBLIC_LIFF_ID` プレフィックス抽出）
  - LIFF API 全 20 ルート（`/api/today` `/api/history` `/api/notifications` `/api/day` `/api/weekly` `/api/chat` `/api/delete` `/api/record/{update,confirm,manual,skip,analyze}` `/api/log/{weight,exercise}` `/api/extras` `/api/predict-weight` `/api/meal-plan` `/api/suggest` `/api/frequent-foods` `/api/notifications/[id]/read` 他既存5ルート）を `withLiffTenant` でラップ、`lineUserId` 自己申告排除
  - `/api/delete` `/api/record/update` に pageId テナント境界チェック（Notion 親 DB 照合、`assertFoodRecordOwnership`）
  - `/api/chat` の Gemini プロンプトに改行除去でプロンプトインジェクション緩和
  - クライアント側 `lib/apiFetch.ts` 新規（`Authorization: Bearer <idToken>` 自動付与 + 401 自動リトライで IDトークン期限切れ対策）
  - LIFF 全画面 + `components/OnboardingFlow.tsx` + `components/WeightExerciseCard.tsx` の生 `fetch` を `apiFetch` に置換（meal-detail/page.tsx fetchData 含む）
- onboarding tour 拡張も同梱（社長作業、staging で動作確認済み）: OnboardingFlow に step 5（体重）・step 6（運動）追加、`exercise/record/weight` に OnboardingTour 統合
- 影響範囲: 顧客側 LIFF 全画面 / 顧客側 API 全 LIFF ルート / 管理画面・store・stripe・cron への影響なし
- 検証: staging.fitmeal.jp で社長動作確認済み（食事記録・編集・体重・運動・履歴・チャット・通知すべて OK）
- 関連: 2026-05-19 セキュリティ監査（lineUserId 自己申告含む Critical 4 件、High 5 件、Medium 3 件すべて対応）

## 2026-05-19 CI 修正: Daily Snapshot Tag workflow の git ident 設定
- fix(.github/workflows/daily-snapshot.yml): `git tag -a` で `fatal: empty ident name not allowed` を起こしていた問題を、`git config user.email/user.name` を step 内で設定して解消
- 影響範囲: ロールバック網（毎日 JST 23:00 に `stable-YYYY-MM-DD` タグを自動作成）
- 背景: 2026-05-16〜18 の3日間連続で workflow が失敗し、`stable-YYYY-MM-DD` の日次タグが作られていなかった。緊急ロールバック手順（AGENTS.md §5）が機能しない状態
- 残課題: 失敗した 5/16〜5/18 分のタグは未生成。次回 5/19 23:00 (UTC 14:00) の自動実行で動作確認

## 2026-05-19 オンボーディングリセットを /store でも表示
- UI改善: 顧客詳細ページのオンボーディングリセットセクションから `isAdminRoute` ガードを撤去。/admin と /store の両方で表示・実行可能に
- API側は `/api/admin/customers/[id]/onboarding` DELETE を共通利用（withAdminTenant が同一の Cookie セッションで /store 利用者も認証可）
- 副次: 未使用となった `usePathname` import を削除
- 影響範囲: 管理画面 /admin/customers/[id] および /store/customers/[id]

## 2026-05-19 オンボーディング再リセットが反映されないバグ修正（customerCache バイパス）
- バグ修正: 管理画面でオンボーディングを2回目以降リセットしても顧客側 LIFF に反映されない問題
- 根本原因: `lib/notion.ts` の `customerCache`（30分TTLのインメモリキャッシュ）が Vercel serverless インスタンスごとに別物のため、admin DELETE のキャッシュ無効化は当該インスタンスにしか効かず、顧客側 `/api/customer/me` が別インスタンスにヒットすると古い「オンボ完了」状態を返していた
- 修正: `getCustomerByLineId` に `force?: boolean` オプションを追加。`/api/customer/me` GET ではキャッシュをバイパス（force: true）して常に Notion から最新値を取得
- 影響範囲: 顧客側 LIFF /home（オンボーディング状態判定） / lib バックエンド
- パフォーマンス影響: `/api/customer/me` は LIFF ホーム読込時に1回呼ばれるのみで Notion レート制限的に問題なし

## 2026-05-19 オンボーディングリセットにアイコン追加・完了通知ポップアップ追加
- UI改善: /admin/customers/[id] のオンボーディングリセット見出しに RotateCcw アイコンを追加し、他セクションと統一
- UI改善: リセット成功時に「オンボーディングをリセットしました。」を alert で表示
- 影響範囲: 管理画面 /admin/customers/[id]

## 2026-05-19 オンボーディングリセットの表現をフラットに変更
- UI改善: /admin/customers/[id] のオンボーディングリセットセクションから「危険な操作」表記と赤系装飾を撤去し、中立な見た目に
- 確認ダイアログの文言も冗長な警告を削減
- 影響範囲: 管理画面 /admin/customers/[id]

## 2026-05-18 顧客詳細の店舗取得エラーをサイレント失敗からエラー表示に変更
- バグ修正: `/store/customers/[id]` の所属店舗ドロップダウンが候補ゼロになる問題を調査
- 根本原因: Notion Integration「メヲダス_GAS連携」が FitMeal 店舗 DB（b74788a7...）に未接続 → Notion API が object_not_found を返すが catch でサイレント失敗していた
- 修正: 店舗取得 fetch のエラーを setError に渡すよう変更（エラーが画面に表示されるようになった）
- 影響範囲: 管理画面 /admin/customers/[id]（= /store/customers/[id]）
- 社長対応必須: Notion「FitMeal 店舗」DB に「メヲダス_GAS連携」インテグレーションを接続する必要あり

機能追加・バグ修正・ロールバックなどの履歴を記録する。

形式:
```
## YYYY-MM-DD HH:MM commit-sha
- カテゴリ: 内容
- ⚠️ ロールバック: 戻した先 と 理由
```

## 2026-05-19 (staging) – ハイブリッドオンボーディング実装（A+B）

- feat(onboarding): ホームオンボ（OnboardingFlow）を5→7ステップに拡張。食事紹介後に「体重も記録できます」「運動も記録できます」ステップを追加し、WeightExerciseCard（data-tour="today-record-card"）をスポットライト
- feat(onboarding): 食事記録ページ（/record）に初回ツアー（OnboardingTour）を追加。写真・テキスト・食品DB・保存バーの4ステップ。localStorage `fitmeal_tour_record_done` で制御
- feat(onboarding): 体重記録ページ（/weight）に初回ツアーを追加。体重入力欄・保存ボタンの2ステップ。localStorage `fitmeal_tour_weight_done` で制御
- feat(onboarding): 運動記録ページ（/exercise）に初回ツアーを追加。種目・時間と強度・保存ボタンの3ステップ。localStorage `fitmeal_tour_exercise_done` で制御
- 影響範囲: 顧客側 LIFF（新規ユーザーのオンボーディング画面・各記録ページ初回表示）

## 2026-05-19 (staging) – Security 追補: WeightExerciseCard 修正 + apiFetch 401 自動リトライ

- fix: components/WeightExerciseCard.tsx の /api/log/weight・/api/log/exercise を apiFetch に置換（生 fetch のままで Authorization header 欠落 → 体重・運動の保存時に 401 になっていた）
- enhance: lib/apiFetch.ts に 401 自動リトライ機構を追加。LIFF を再初期化（refreshLiff）して新 IDトークンで再送信。IDトークン1時間期限切れ対策
- 影響範囲: 顧客側 LIFF（体重・運動入力 / IDトークン期限切れケース全般）
- 関連: 2026-05-19 (staging) – Security Critical の staging 動作確認指摘

## 2026-05-19 (staging) – onboarding: HomeOnboarding 削除 & markOnboarded apiFetch 修正

- fix(onboarding): markOnboarded() が生 fetch を使い Authorization ヘッダー欠落 → withLiffTenant が 401 で静かに失敗し onboardingCompletedAt が Notion に保存されずオンボ再表示されるバグを修正。apiFetch に変更し IDトークンが付与されるようにした
- fix(onboarding): HomeOnboarding（アクション誘導型・localStorage ベース）を削除。新 OnboardingFlow がメインのオンボになったため不要
- 影響範囲: 顧客側 /home（LIFF）、components/OnboardingFlow.tsx

## 2026-05-19 (staging) – admin/customers/[id]: オンボリセット UI を main に同期

- ui(admin): staging の customers/[id]/page.tsx を main と同一内容に統一
- 変更点: isAdminRoute ガード撤去（/store でもリセット表示）、RotateCcw アイコン復元、confirm/alert 文言を main 準拠に、STATUS_BADGE_CLASSES 復元、StatusInfoPopover の containerRef+addEventListener 方式を復元
- 影響範囲: 管理画面 /admin/customers/[id]（顧客側なし）

## 2026-05-19 (staging) – Security Critical: LIFF lineUserId 自己申告なりすましを修正

- Security(Critical): LIFF lineUserId 自己申告なりすましを修正
- 影響範囲: 顧客側 API 全LIFFルート（13新規ラップ + 既存5ルート挙動更新） / 顧客側全LIFF page (fetch wrapper)
- 詳細: LINE IDトークンをサーバーで LINE Verify API 検証 / pageIdテナント境界チェック
- 関連: セキュリティ監査 2026-05-19
- 追補(code-review対応): 未保護ルート5件追加ラップ（extras/predict-weight/meal-plan/suggest/frequent-foods）、notifications/[id]/read を withLiffTenant ラップ、aud検証追加、LRU eviction バグ修正、meal-plan/notifications/record の apiFetch 置換漏れ3件修正
- 追補2: channel ID を専用 env から取得する方式をやめ NEXT_PUBLIC_LIFF_ID のプレフィックス抽出に変更（env 追加作業を回避。Channel ID は元々公開情報のためサーバー検証への使用も安全）

## 2026-05-19 (staging) – オンボーディング追加修正 3点

- fix: OnboardingFlow 表示中に HomeOnboarding（OnboardingTour）が同時起動して背景が濃いグレーになる問題を修正（showOnboarding=true のとき HomeOnboarding をレンダリングしない）
- fix: ステップ切り替え時のポップ・スポットライトのズレ解消（setTimeout → requestAnimationFrame に変更し同フレームで rect 取得）
- fix: ステップ2（食事記録スポットライト）右上の浮いた「スキップ」ボタンを削除し、ポップ内の × ボタンのみに統一
- 影響範囲: 顧客側（新規ユーザーのオンボーディング画面）
- 変更ファイル: app/home/page.tsx, components/OnboardingFlow.tsx

## 2026-05-19 (staging) – オンボーディング UX 3点修正

- fix: スキップ/完了ボタン押下後にオンボーディングが再表示されるバグを修正（fetch を await 化して API 完了を待ってからリダイレクト）
- fix: ステップ4・5のオーバーレイを bg-black/50 → bg-black/20 に変更し、全ステップで裏の実画面が透けて見えるように統一
- 影響範囲: 顧客側（新規ユーザーのオンボーディング画面）
- 変更ファイル: components/OnboardingFlow.tsx

## 2026-05-19 19:00 (staging) – 食事記録テキスト入力 PFC 推定プロンプト改善
## 2026-05-19 – 食事記録テキスト入力 PFC 推定プロンプト改善（staging cherry-pick）

- 食事記録: テキスト入力の PFC 推定プロンプト（analyzeTextPfc）を和食定番向けに改善
- 影響範囲: 顧客側（テキスト記録時の PFC 値）
- 背景: 玄米C・味噌汁全数値が約2倍になる症状の修正（「あすけんより高い」クレーム根本原因の一つ）
- 修正内容: 穀類重量=炊飯後解釈・味噌汁デフォルト構成明示・納豆1パック=40g・卵料理油量デフォルト・「控えめに見積もる必要はない」を削除し「過大な大盛り想定は避ける」に置換
- 検証: 顧客入力例（玄米80g・納豆1パック・オムレツ・味噌汁豆腐50g）で P23→20/F19→18.7/C40→38/kcal425→403 に正常化

## 2026-05-19 – AdminShell ナビに「契約」タブ追加

- ui(AdminShell): 上部メニューに `/billing` リンク（アイコン `CreditCard`、ラベル「契約」）を追加。/admin と /store の両方で表示
- 影響範囲: 管理画面 / 店舗画面のヘッダーナビ

## 2026-05-19 – 契約管理機能リリース（席数管理 + 新プラン構造 + 招待上限ブロック）

- feat: Stripe サブスクリプション構造を新プランに移行（サポート費¥5,000 + per-user: Starter¥2,500/Growth¥2,000/Scale¥1,500、ミニマム3名）
- feat: `lib/stripe.ts` を新プラン料金関数に置換（getPlanTierBySeats / getMonthlyTotal / getPriceIdForTier 等）
- feat: `lib/notion.ts` TenantRow に `seatLimit / planTier` を追加、Notion `契約席数` / `プラン種別` 列と同期
- feat: `lib/seats.ts` 新規作成（getSeatStatus / invalidateSeatCache、60秒キャッシュ）
- feat: `/api/stripe/checkout` を 2 line_item 構造に改修（サポート費 + per-user）
- feat: `/api/stripe/webhook` の handleSubscriptionUpdate で per-user item の quantity を seatLimit として Notion に書き戻し
- feat: `/api/stripe/preview-seats` 新規作成（増枠時の日割り差額プレビュー）
- feat: `/api/stripe/update-seats` 新規作成(席数変更確定 + プラン境界跨ぎ対応)
- feat: `/api/admin/billing/info` に seatLimit / currentSeats / isOverLimit / isNearLimit / planTier / hasContract を追加
- feat: `/api/admin/customers` POST・`/api/admin/customers/[id]/invite-link` POST に席数上限チェック追加
- feat: `app/admin/billing/page.tsx` を契約状況メインに大幅改修（席数プログレスバー・プラン比較カード・上限バナー）
- feat: `app/admin/billing/SeatChangeModal.tsx` 新規作成（増枠/減枠モーダル + 日割り差額プレビュー）
- feat: `app/admin/page.tsx` に席数上限バナー・招待リンクボタン disable 追加
- feat: `app/admin/customers/new/page.tsx` に席数上限時フォームブロック追加
- docs: `docs/STRIPE_PRODUCTION_SETUP.md` 新規作成（社長向け Stripe 本番設定手順書）
- 影響範囲: 管理画面 / Stripe API / Notion テナント DB（顧客側 LIFF への変更なし）

## 2026-05-19 (staging) – オンボーディング ようこそ画面に背景＋食事記録への直接導線

- ui(OnboardingFlow): step1（ようこそ画面）のオーバーレイを `bg-black/50` → `bg-black/20` に薄くし、裏のホーム画面が透けて見えるように
- ui(OnboardingFlow): CTAを「使い方を見る」→「食事を記録」に変更。タップでオンボ完了 + `/record` へ遷移（新規 `completeAndRecord` 関数）。「使い方を見る」はサブリンクとして残置
- ui(OnboardingFlow): 「まずは使い方をご案内します。」の一文を削除（CTA変更に合わせて文言整理）
- refactor(app/home): `onboardingDone === false` 時の空 main プレースホルダー return を廃止。ホーム本体を常に描画し、OnboardingFlow を上にオーバーレイ表示するよう変更。これにより既存のスポットライト要素（`data-onboarding="meal-cards"` 等）が機能するようになる副次効果あり
- 影響範囲: 顧客側 LIFF /home（初回オンボーディングフロー）

## 2026-05-19 00:50 – staging Basic Auth を全面撤廃

- 変更: `proxy.ts` から staging Basic Auth ガード（`isStagingHost` / `checkBasicAuth` / `basicAuthResponse`）を全削除
- 理由: LIFF顧客側は LINE OAuth (`liff.login`)、/admin /store は scrypt+Cookie で既に二重に守られている。Basic Auth は除外ルールの取りこぼし（icon.svg / manifest.webmanifest / RSC fetch 等）でログインダイアログが繰り返し表示される不具合の温床になっていた
- 検索エンジン対策: `app/robots.ts` が staging.fitmeal.jp で `Disallow: /` を返す設定済み（既存）
- 影響範囲: staging / preview のみ。本番は元から PASSTHROUGH_HOSTS で除外されていたため変化なし
- TODO: 社長対応 — Vercel から `STAGING_BASIC_AUTH_USER` / `STAGING_BASIC_AUTH_PASSWORD` 環境変数を削除（残しても無害だが整理のため）

## 2026-05-19 00:45 – staging Basic Auth: /manifest.webmanifest も除外（前回の除外漏れ）

- 修正: `proxy.ts` で `/manifest.webmanifest` `/manifest.json` を Basic Auth 除外に追加
- 原因: 前回の修正で `/icon.svg` は除外したが、login ページの HTML が参照する `<link rel="manifest" href="/manifest.webmanifest">` は除外漏れで 401 を返し続けていた
- 影響範囲: staging / preview のみ

## 2026-05-19 00:40 – staging Basic Auth: Next.js metadata files (/icon.svg 等) を除外

- 修正: `proxy.ts` で staging Basic Auth ガードから `/icon.svg` `/apple-icon.*` `/opengraph-image.*` `/twitter-image.*` `/robots.txt` `/sitemap.xml` を除外
- 原因: `app/icon.svg` が `/icon.svg` でルート直下に配信され、Basic Auth で 401+WWW-Authenticate を返していた。ブラウザはこの subresource の 401 でログイン画面表示中も Basic Auth ダイアログを再表示していた
- 影響範囲: staging / preview のみ（本番には影響なし）

## 2026-05-18 23:55 – staging Basic Auth から /admin /store を除外（ログイン後 RSC fetch で 401 ダイアログ再表示する不具合修正）

- 修正: `proxy.ts` で staging Basic Auth ガードから `/admin/*` `/store/*` `/api/admin/*` `/api/store/*` を除外
- 原因: ログイン成功後の `router.replace('/admin')` で走る RSC fetch に Basic Auth ヘッダーが付与されず 401+WWW-Authenticate が返り、ブラウザがダイアログを再表示していた
- 影響範囲: staging / preview のみ（本番には影響なし）。admin/store は元々 scrypt+Cookie 認証で守られているため Basic Auth 除外は問題なし

## 2026-05-18 (staging) – staging の /admin/login で「ログイン中…」のままになるバグ修正

- 不具合: staging.fitmeal.jp/admin/login でメール/パスワードを入力してログインボタンを押すと、ブラウザが `https://staging.fitmeal.jp` へ再度 Basic Auth ダイアログを表示し「ログイン中…」のまま進まない
- 原因: `proxy.ts`（Middleware）の Basic Auth ガードが `/api/admin/auth/login` にも適用されていた。ブラウザは初回ページロード時の Basic Auth 資格情報を `fetch()` リクエストに自動付与しないため、ログイン API POST が 401 を返しブラウザが再度 Basic Auth ダイアログを表示していた
- 修正: `proxy.ts` の staging Basic Auth ブロックに `isAuthApi` 除外条件を追加。`/api/admin/auth/*` および `/api/store/auth/login` はBasic Auth チェックをスキップ
- 影響範囲: staging 環境のみ（Basic Auth は staging/preview にのみ適用）。本番への影響なし

## 2026-05-18 (staging) – 招待認証ページを /home/onboard に移管（LIFF OAuth 400 修正）

- 不具合: 旧 invite link `https://liff.line.me/<LIFF_ID>/onboard?token=...` を踏むと LIFF Endpoint URL `/home` 配下に解決して `/home/onboard` が存在せず 404。本日 main で `/onboard?token=...` の直URLに変更したところ、今度は `liff.login()` の redirect_uri が `/onboard`（Endpoint URL `/home` の配下でない）になり LINE 側で 400 Bad Request を返すように
- 修正:
  - 新規 `app/home/onboard/page.tsx` — 既存 `/onboard` の LIFF 認証 + redeem ロジックを `/home/onboard` に移植。Endpoint URL `/home` の配下にあるため `liff.login()` redirect_uri が LINE の検証を通る
  - `app/onboard/page.tsx` を server-side redirect 化（token 引数を保持したまま `/home/onboard?token=...` へ転送）。本日 main 経由で発行された旧形式 `app.fitmeal.jp/onboard?token=...` リンクの後方互換用
  - 既存 `invite-link/route.ts` の `liff.line.me/<ID>/onboard?token=...` URL は据え置き（resolve 先 `/home/onboard` が存在するようになったので動作する）
- 影響範囲: 顧客側 LIFF /onboard（リダイレクト化）, /home/onboard（新規） / 管理画面の招待リンクコピー
- 検証手順: staging.fitmeal.jp の管理画面で招待リンクを発行 → 開発用 LINE で開く → 認証完了画面まで到達することを確認

## 2026-05-18 (staging) – ホーム一覧の食事サムネイル重複排除
- 経緯: staging a512ff7 から cherry-pick（他の staging commit—契約管理機能等—は別途マージ予定のため除外）

## 2026-05-18 – 招待認証ページを /home/onboard に移管（LIFF OAuth 400 修正・第2弾）

- 不具合: 本日 5ab0537 で invite link を `https://app.fitmeal.jp/onboard?token=...` の直URL形式に変えたところ、`liff.login()` の redirect_uri が `/onboard`（LIFF Endpoint URL `/home` の配下でない）になり LINE 側 access.line.me で 400 Bad Request を返すように。顧客「中西さん」が踏んで詰まった
- 修正:
  - 新規 `app/home/onboard/page.tsx` — 既存 `/onboard` の LIFF 認証 + redeem ロジックを `/home/onboard` に移植。Endpoint URL `/home` の配下にあるため `liff.login()` redirect_uri が LINE の検証を通る
  - `app/onboard/page.tsx` を server-side redirect 化（token 引数を保持したまま `/home/onboard?token=...` へ転送）。本日発行済みの旧 `app.fitmeal.jp/onboard?token=...` リンクの後方互換用
  - 既存 `invite-link/route.ts` の URL は据え置き（直URL `/onboard?token=...`、上記の redirect 経由で /home/onboard に到達）
- 影響範囲: 顧客側 LIFF /onboard（リダイレクト化）, /home/onboard（新規）
- 検証手順: 本番 /admin でテスト顧客に招待リンク発行 → 社長が iPhone LINE で踏み、認証完了画面まで到達することを確認 → OK なら中西さんに再送
- staging 経由を試みたが staging /admin/login の JS hydration 問題で検証不能のため、cherry-pick で main に直適用（AGENTS.md 緊急バグ修正条項）

## 2026-05-18 – 招待リンク 404 修正（顧客認証URLが開けない致命バグ）

- fix(api/admin/customers/[id]/invite-link): 招待リンクを `https://liff.line.me/<LIFF_ID>/onboard?token=...` で生成していたが、LIFF Endpoint URL が `https://app.fitmeal.jp/home` を指している運用のため、LIFF が `https://app.fitmeal.jp/home/onboard?token=...` に解決して 404 になっていた。`${NEXT_PUBLIC_APP_URL}/onboard?token=...` の直接URL形式に変更（/onboard ページ自体が `liff.init()` + `liff.login()` を内包しているため、LIFF 経由でなくとも認証可）
- chore: 未使用の `fetchOfficialLineUrl` import を削除
- 影響範囲: 管理画面から発行される顧客招待リンク全般（本番）。発行済みの旧 LIFF 形式リンクは引き続き 404 のため、対象顧客には再発行が必要
- 緊急修正のため main 直push（AGENTS.md ルール4: `app/api/admin/*` 配下）
- 注: この修正は OAuth redirect_uri 不整合で 400 を引き起こすことが発覚し、上記「第2弾」で /home/onboard 移管に切り替えた

## 2026-05-18 – ホーム一覧の食事サムネイル重複排除

- fix(app/home): 1枚の写真から複数食材が判定された場合、ホーム画面の食事カードに同じ写真が複数並んでいた問題を修正。`imageUrl` で重複排除し、ユニークな写真のみ表示
- 影響範囲: 顧客側（ホーム画面の食事カード下部のサムネイル列）。食事詳細ページのサムネイル表示は従来どおり全枚数を表示

## 2026-05-18 – Gemini プロンプトを「写真主体・メモは参考値」に変更

- feat(lib/gemini): 食事推定プロンプトのスタンスを切り替え。これまで「量明示メモ最優先」だった挙動を「写真主体・メモは参考値」に変更。メモの量明示（「100g」「1杯」等）は参考扱いで、写真と近ければ採用、ずれていれば写真優先
- 修飾語（ノンオイル等）の反映と、写真に映ってない料理の追加申告は引き続き採用
- 影響範囲: 顧客側 LIFF /record（推定値の挙動）
- 背景: 教科書値ベース計算で全体的に高く出ていた問題を、画像認識主体の推定で実態に近づける狙い。補正係数による事後補正と併用

## 2026-05-18 – 顧客詳細 2件のバグ修正（StatusInfoPopover 幅・所属店舗ドロップダウン）

- fix(admin/customers/[id]): StatusInfoPopover のコンテナを max-w-xs から w-72 固定幅に変更。items-center → items-start、説明テキストに flex-1 leading-relaxed を付与し日本語が1文字ずつ縦に折り返す現象を修正
- 影響範囲: 管理画面 /admin/customers/[id]（/store/customers/[id] も同ファイル）
- 備考: 所属店舗ドロップダウン空は Notion 店舗DB にデータ未登録が原因（コードは正常）→ 社長に確認依頼

## 2026-05-18 – StatusInfoPopover をバッジ+1行説明の2カラム形式に変更

- UI(admin/customers/[id]): StatusInfoPopover のテキストリストを「バッジ+短い説明」の横並びレイアウトに変更。バッジ色は admin/page.tsx の StatusBadge と完全一致（STATUS_BADGE_CLASSES 定数で管理）
- 影響範囲: 管理画面 /admin/customers/[id]（社長のみ）

## 2026-05-18 – 診断 API /api/debug-calibration を削除

- chore(api/debug-calibration): staging 動作確認用に追加した診断エンドポイントを削除（役目終了）
- 影響範囲: API。staging/本番ともに /api/debug-calibration は 404 になる

## 2026-05-18 – セキュリティ: CRON_SECRET 本番設定 + StatusInfoPopover onBlur 修正

- fix(security): CRON_SECRET が本番 env 未設定のため認証ロジックがバイパスされていた。Vercel Production / Preview / Development の全環境に設定し、以降 Bearer 認証が必須になる。再デプロイ後から有効
- fix(admin/customers/[id]): StatusInfoPopover の onBlur でモバイルタップ直後にポップオーバーが閉じる問題を修正。useEffect + document.addEventListener('pointerdown') による外側クリック検知に変更、Esc キーでも閉じるよう対応
- 影響範囲: API /api/cron/update-calibrations・/api/cron/daily-reports（認証強化）、管理画面 /admin/customers/[id]

## 2026-05-18 – PFC キャリブレーション: items 配列にも係数を適用

- fix(lib/gemini): `parsePfcJson` で合計 P/F/C のみに calibration を掛けていたが、items 配列の各品目には掛かっていなかった。`/record/analyze` の画面表示は items を表示するため、補正が UI 上反映されなかった
- 修正: items 配列の各 P/F/C にも calibration を乗算し、合計と表示値の整合性を維持
- 影響範囲: 顧客側 LIFF /record（画面表示の P/F/C 値）

## 2026-05-18 – ステータスドロップダウンにⓘツールチップ追加
- feat(store/admin): 顧客詳細「基本情報」ステータスラベル横にInfoアイコンを追加
- feat(store/admin): クリックで各ステータス（設定中・進行中・休止中・卒業）の説明ポップオーバーを表示
- 影響範囲: 管理画面（/admin および /store 共有コンポーネント）のみ。顧客側 LIFF への影響なし

## 2026-05-18 (staging) – PFC キャリブレーション テナント別自動補正

- feat(calibration): テナント別の PFC キャリブレーション係数を Notion テナント DB に追加。`PFC推奨_P/F/C`（cron 自動更新）+ `PFC適用_P/F/C`（社長の手動オーバーライド）の 6 列
- feat(gemini): `analyzeImagesPfc` / `analyzeTextPfc` に `calibration` 引数を追加。テナント解決した係数を Gemini 推定値に乗算
- feat(cron): `/api/cron/update-calibrations` を新設。日次 JST 03:00 (UTC 18:00) に全テナントを巡回し、過去 30 日のトレーナー修正データから推奨係数を算出して Notion に書き戻す
- feat(lib): `lib/calibration.ts` を新設し集計ロジックを共通化（トレーナー修正のみ + 未修正 ratio=1.0 で選択バイアス対策 + 上下 5% トリム + 0.7〜1.3 クリッピング + 30 件閾値）
- refactor(api/admin/corrections): 集計ロジックを `lib/calibration.ts` に委譲。レスポンスに `calibrationDetails`（サンプル数・スキップ理由）を追加
- 影響範囲: 顧客側 LIFF（食事推定値の補正）/ 管理画面 / API / Cron
- 背景: 顧客から「あすけんより数値が高い」とクレーム。トレーナーが Notion で修正したデータに基づき係数を自動学習する仕組み

## 2026-05-18 (staging) – /onboard 完了画面の説明短縮
- ui(onboard): 「食事の写真送信・体重記録・前日レポート受信もすべて公式LINEから行います。」段落を削除

## 2026-05-18 (staging) – 招待リンク shareText の冒頭文言を修正
- ui(invite-link): タイトル行「【FitMeal 食事管理プログラム】」を削除
- ui(invite-link): 「下記をタップしてアカウント連携を完了してください」→「下記をタップして食事管理プログラムへのアカウント認証を完了してください」

## 2026-05-18 (staging) – 文言微修正「食事管理のURLにアクセス可能です」
- ui(onboard, invite-link): 「FitMeal にアクセスできるようになります」→「食事管理のURLにアクセス可能です」に統一

## 2026-05-18 – 「承認する」ボタン削除 + 招待文言をリッチメニュー導線に合わせる
- ui(admin): 顧客一覧の「承認する」ボタン削除（招待リンク経由で自動的に進行中になるため不要）。`approveCustomer` 関数・`approvingId` state・`CheckCircle` import も削除
- ui(api/invite-link): shareText を `/onboard` 完了画面の文言と合わせて修正
  - 旧: 「公式LINEの友だち追加もお願いします（前日レポートや自動通知のため必須）」
  - 新: 「公式LINEを友だち追加していただくと、リッチメニューから FitMeal にアクセスできるようになります」
- 影響範囲: 管理画面 /admin / API

## 2026-05-18 (staging) – onboard 完了画面の文言と CTA を見直し
- ui(onboard): 「あとで → 食事管理を始める」ボタンを削除（公式LINE追加が必須導線のため）
- ui(onboard): 説明文を「友達追加 → 公式LINEのリッチメニューから FitMeal にアクセス」フローに合わせて修正
- ui(onboard): 未使用の useRouter import を削除
- 影響範囲: 顧客側 LIFF /onboard

## 2026-05-18 (staging) – パターンB: LIFF認証→完了画面で公式LINE 友達追加へ誘導
- ui(onboard): redeem 完了画面に「✅ 公式LINEを友だち追加する」ボタンを追加（緑、目立つ）
  - サブで「あとで → 食事管理を始める」ボタン（白）
  - 自動 /home 遷移（2秒タイマー）を削除、ユーザーが選択
- feat(api/onboard/redeem): レスポンスに officialLineUrl を含める（テナントDB > Bot API 自動取得 > env の3段階）
- feat(api/admin/customers/[id]/invite-link): shareText を「招待リンクのみ」に簡素化。STEP 1 ブロックを削除
  - 店舗の送付テキストは1リンクだけ（顧客は1クリックで開始 → 完了画面で公式LINE追加へ）
- feat(lib/tenant.ts): MEWODAS_TENANT に lineChannelToken: env LINE_CHANNEL_ACCESS_TOKEN を追加（自動取得用）
- 影響範囲: 顧客側 LIFF /onboard / API / lib

## 2026-05-18 – 公式LINE URL を LINE Bot API から自動取得
- feat(lib/lineBot.ts): 新規。`fetchOfficialLineUrl(channelToken)` を追加。`GET /v2/bot/info` から basicId/premiumId を取得して `https://line.me/R/ti/p/{id}` を組み立てる。6時間キャッシュ
- feat(api/admin/customers/[id]/invite-link): 招待リンク生成時の公式LINE URL 取得を3段階優先に
  1. テナントDB「公式LINE URL」プロパティ（手動設定）
  2. LINE Bot API から自動取得（Channel Token 経由）
  3. env OFFICIAL_LINE_URL（最終フォールバック）
- 効果: テナント DB の「公式LINE URL」を空にしても、Channel Token があれば自動で友だち追加URL が shareText に含まれる
- 影響範囲: API / lib

## 2026-05-18 (staging) – 招待リンクコピーで案内文+公式LINE URL も同時コピー
- feat(api/admin/customers/[id]/invite-link): レスポンスに `shareText` を追加。「【FitMeal 食事管理プログラム】… STEP 1 公式LINE / STEP 2 招待リンク …」の定型文に顧客名・公式LINE URL・招待リンクを埋め込んで返す
- feat(admin/page.tsx): 「招待リンクをコピー」「承認する」両方の clipboard 書き込みを `j.shareText || j.url` に変更。トースト文言を「招待リンク（案内文付き）をコピーしました」に
- feat(lib/notion.ts, lib/tenant.ts, lib/tenantResolver.ts): TenantRow / TenantConfig に `officialLineUrl` を追加。Notion テナントDBの「公式LINE URL」(URL型) プロパティを読み込む
- env: `OFFICIAL_LINE_URL` を後方互換フォールバックとして残置（テナントDB値が優先）
- 関連: テナントDB「公式LINE URL」プロパティは notion-ops 経由で追加済み。各テナントは Notion で値設定
- 影響範囲: 管理画面 /admin（招待リンクコピー）/ API / lib

## 2026-05-18 (staging) – ホーム順序入れ替え（今日の記録を上に）
- ui(home): 「体重・運動カード（今日の記録）」と「体重目標進捗」の順序を入れ替え。今日の記録が上、体重目標進捗が下
- 影響範囲: 顧客側 LIFF /home

## 2026-05-18 (staging) – ホームの体重目標進捗に +/- 符号表示
- ui(home): 「残り」「必要ペース」の数値に方向符号を付与（減量なら -、増量なら +）
  - 旧: 「残り 10.5 kg」「必要ペース 0.8 kg/週」← 増減方向が不明
  - 新: 「残り -10.5 kg」「必要ペース -0.8 kg/週」（現在 > 目標の場合）
- 影響範囲: 顧客側 LIFF /home の「体重目標進捗」セクション

## 2026-05-18 (staging) – input レイアウトを relative+absolute に戻しネイティブスピナー復活
- fix(globals.css): input[type="number"] のスピナー非表示 CSS を削除し、ネイティブスピナーを復活
- fix(admin/customers/[id]): NumberInput・目標体重・目標カロリー・PFC(g)・TDEE・PFC(%) の flex レイアウトを relative+absolute に戻す。suffix は right-8/top-1/2 で absolute 配置、input は pr-12+text-center
- fix(admin/customers/new): 同上（NumInput コンポーネント + 各フィールド）
- 影響範囲: /admin/customers/[id] / /admin/customers/new / /store/customers/[id] / /store/customers/new（re-export 自動反映）

## 2026-05-17 (staging) – 警告文言微修正
- ui(admin): 警告 2段落目末尾を「目標日や体重の見直しを推奨します（トレーナー判断で保存も可）。」に修正（〜推奨 → 〜推奨します）
- 影響範囲: /admin/customers/{[id]|new}（/store も自動反映）

## 2026-05-17 (staging) – input サフィックスレイアウトを absolute → flex に変更
- ui(admin/customers/[id]): NumberInput・目標体重・目標カロリー・PFC(g)・TDEE・PFC(%) の relative+absolute 配置を flex レイアウトに変更。数値右寄せ + サフィックスが数値直右に固定される一貫した見た目に
- ui(admin/customers/new): 同上（NumInput コンポーネント + 目標カロリー・PFC・TDEE 各フィールド）
- focus リングは外枠 div の focus-within:ring-2 で再現。input 自体の ring は削除
- 影響範囲: /admin/customers/[id] / /admin/customers/new / /store/customers/[id] / /store/customers/new（re-export 自動反映）

## 2026-05-17 (staging) – 顧客詳細・新規作成フォームUI改善（単位サフィックス・バナー1行化・警告1段落化）
- ui(admin/customers/[id]): 年齢/身長/現在体重/目標体重/TDEE/目標カロリー/PFC(g)/PFC(%) の各 input・読み取り専用 div にラベル内単位を廃止しサフィックスとして input 右側に表示。NumberInput コンポーネントに suffix prop 追加
- ui(admin/customers/new): 同上。NumInput コンポーネントに suffix prop 追加
- ui(admin/customers/[id]): 残日数バナーを flex 1行に変更（日数／減量kg／kcal削減を inline 表示）、計算式行（× 7,700 ÷ X日）を削除
- ui(admin/customers/new): 同上
- ui(admin/customers/[id]): 安全警告を箇条書き廃止・1段落テキストに統合（isUnsafeDeficit/isUnsafeSurplus/isUnsafeGoalKcal を動的に文中に埋め込み）
- ui(admin/customers/new): 同上
- 影響範囲: /admin/customers/[id] / /admin/customers/new / /store/customers/[id] / /store/customers/new（re-export 自動反映）

## 2026-05-17 (staging) – number input ネイティブスピナー非表示
- ui(globals.css): `<input type="number">` のネイティブスピナー（上下矢印）を全画面で非表示に
  - ネイティブスピナーは CSS で位置を変えられず、サフィックス（kg/kcal/g/% 等）と重なる問題があった
  - モバイルでは inputMode="decimal" で数値キーボードが出るため、スピナー無くても入力しやすい
  - PC ではユーザーが直接タイプ入力
- 影響範囲: 全画面の `<input type="number">`（管理画面・顧客側）

## 2026-05-17 (staging) – サフィックス位置を更に左へ + 警告文短縮
- ui(admin): input サフィックス位置を更に左へ。pr-10/right-8 → **pr-14/right-12**（スピナーの左側に確実に表示）
- ui(admin): 警告文 2段落目を短縮して 2 行に収まるように。「過度な減量／増量は健康リスクあり。目標日や体重の見直しを推奨（トレーナー判断で保存も可）。」
- 影響範囲: /admin/customers/{[id]|new}（/store も自動反映）

## 2026-05-17 (staging) – サフィックス位置調整 + 警告 2段落化
- ui(admin): 単位サフィックス位置を input 内（スピナーの左）に移動。pr-8 → pr-10、right-3 → right-8
- ui(admin): 警告バナーを 2 段落に分離（条件説明 → リスクと推奨）
  - 1段落目: 「⚠️ 健康上の安全範囲を超えています：（該当条件）です。」
  - 2段落目: 「過度な減量／増量は筋肉量低下・代謝低下・リバウンドのリスクがあります。可能であれば目標達成日を後ろにずらすか目標体重を見直してください。トレーナー判断で進める場合はこのまま保存可能です。」
- 影響範囲: /admin/customers/{[id]|new}（/store も自動反映）

## 2026-05-17 (staging) – PFC を目標体重ベースに / 表示太字解除
- fix(lib/goalCalc): PFC (P/F/g) 計算の基準を currentWeight → targetWeight（目標体重）に変更。targetWeight 未設定なら currentWeight にフォールバック。これにより目標体重の増減で P/F (g) も連動する
- ui(admin): TDEE 表示・PFC% 表示の読み取り専用カラムから `font-bold` を削除。input カラムと文字ウェイトを統一
- 影響範囲: lib/goalCalc.ts / /admin/customers/{[id]|new}

## 2026-05-17 (staging) – 体重ログを独立 Notion DB から読み書き（Phase 2/3）
- feat(lib/repository/weightLogs.ts): 新規作成。createWeightLog（upsert）/ listWeightLogsByLineUser / getLatestWeight / getWeightOnDate / deleteWeightLog
- feat(lib/notion.ts): TenantRow に weightDbId 追加、parseTenantPage で「Notion 体重DB ID」プロパティ読み取り。createTenantWeightDb 追加（body スキーマ: 日付 title / 体重(kg) number / LINEユーザーID / 顧客名 / メモ / 入力経路 select）。insertTenantRow に weightDbId 追加
- feat(lib/tenant.ts): TenantConfig に notionWeightDbId 追加。MEWODAS_TENANT に NOTION_WEIGHT_DB_ID env 読み込み
- feat(lib/tenantResolver.ts): loadTenants で notionWeightDbId を TenantConfig に詰める
- feat(app/api/log/weight): GAS + createWeightLog を Promise.allSettled で並列実行（GAS 失敗時も新DBに書き込むフェイルセーフ）
- feat(app/api/extras): 体重を getWeightOnDate（新DB）から取得。運動データは引き続き個人シートから
- feat(app/api/today): getLatestWeight で新DBの最新体重を取得し currentWeight を上書き
- feat(app/api/admin/customers/[id]/weight-history): getRangeExtras（個人シート走査）から listWeightLogsByLineUser（新DB）に切替
- feat(app/api/admin/tenants): テナント新規作成時に createTenantWeightDb も並列実行し weightDbId を登録
- 影響範囲: 顧客側 LIFF /home 体重表示・/api/extras・/api/today、管理画面 /admin 体重グラフ、テナント自動プロビジョニング
- DB ID: staging 5792ca16741248d7af1d31d2e5f935a8 / 本番 9caa86778586437eb39336623df9e65f

## 2026-05-17 (staging) – 体重目標進捗の「現在」を最新ログ優先表示に
- fix: app/home/page.tsx で goalProgress 計算時、`today.weight` (今日の体重ログ) があればそれを優先して currentWeight に使う
- 旧挙動: 顧客DBの「現在体重」プロパティのみを参照。日々の体重ログでは自動更新されないため値が固定（小川由佳子様で発覚: DB値 63.6kg のまま、最新ログは 62.7kg）
- 新挙動: 今日の体重を入力すれば即座に「現在」表示が反映される
- 影響範囲: 顧客側 LIFF /home の「体重目標進捗」セクション
- 残課題: 「今日未入力で過去日に最新ログがある」ケース → 直近 N 日の最新ログ取得 API を追加するか、GAS/API で顧客DBの「現在体重」を自動更新する仕組みが必要

## 2026-05-17 (staging) – 本番hotfix同期: extras 体重 fallback 削除
- hotfix: /api/extras から `customer.currentWeight` フォールバックを削除（本番の hotfix と同内容を staging にも反映）
- 関連: main c058220 / 本番で「今日の体重未入力なのに過去値が表示される」バグの修正
- 影響範囲: 顧客側 LIFF /home の体重入力欄

## 2026-05-17 (staging) – 顧客編集画面 UI 改善（氏名編集・calcGoals 統一・バナー改修）
- feat(admin/[id]): 基本情報セクションで氏名を input で編集可能に。save 時に name を PATCH payload に含め Notion の「氏名」title プロパティを更新
- feat(lib): CustomerPatch 型・updateCustomer・PATCH ハンドラに name フィールドを追加
- refactor(admin/[id]): ローカル calcMifflin + ACTIVITY_FACTOR を削除し lib/goalCalc の calcGoals に統一。targetWeight + targetDate がある場合は体重差×7700÷残日数で自動計算
- fix(admin/[id], admin/new): 残日数バナーから「計算式: kcal -500 / ...」併記を削除
- feat(admin/[id], admin/new): 体重差表示を「あと Xkg 減量」「あと Xkg 増量」「現体重キープ」形式に変更
- feat(admin/[id], admin/new): バナーに「1日あたり -N kcal 削減 / +N kcal 追加」と計算式 (Xkg × 7,700 ÷ N日) を追加。体重・目標日未入力時はヒントを表示
- 影響範囲: 管理画面 /admin/customers/[id]、/admin/customers/new、/store/customers/[id]、/store/customers/new（re-export）、API /api/admin/customers/[id]、lib/notion.ts、lib/repository/customers.ts

## 2026-05-17 (staging) – クランプ撤去・警告強化
- feat(lib): calcGoals の **clamp ロジックを撤去**。1日あたり調整 kcal も目標 kcal も計算値そのまま使う
  - 旧仕様: 1日 ±1,000kcal / 目標 1,200〜4,000kcal で自動クランプ → 極端な目標体重では値が動かない
  - 新仕様: 計算値そのまま使用 + 警告フラグ（isUnsafeDeficit / isUnsafeSurplus / isUnsafeGoalKcal）を返す
- ui(admin): 警告バナーを「クランプ」表現から「健康上の安全範囲を超えています」に文言変更
  - 該当条件を箇条書きで明示（1日±1,000kcal 超 / 目標 1,200〜4,000kcal 外）
  - 「トレーナー判断で進める場合はこのまま保存可能です」と明記
- 影響範囲: lib/goalCalc.ts / /admin/customers/{[id]|new}

## 2026-05-17 (staging) – クランプ警告追加
- ui(admin): 残日数バナーに「1日あたり調整 kcal がクランプされた場合の警告」を追加（両ページ）
  - 計算上 -2,566 kcal/日 等になる極端な目標体重差では、安全上限 -1,000 kcal/日 で自動クランプされる
  - 従来は警告無しで「目標体重を変えても結果が動かない」と見えていたため、黄色バナーで明示
  - 文言: 「計算上 N kcal/日 必要ですが、健康上の安全上限（1日±1,000kcal）でクランプしています。目標達成日を後ろにずらすか、目標体重を見直してください」
  - 計算式表示も `(Xkg × 7,700 ÷ N日 = M kcal/日)` の形に拡張（生の計算値を明示）
- 影響範囲: /admin/customers/{[id]|new}

## 2026-05-17 (staging) – UI 細かい調整
- ui(admin): LINE ユーザーID を /store/customers/new で**表示するが readOnly**（input は薄グレーで cursor-not-allowed）。/admin は引き続き編集可能
- ui(admin): 身体情報の注釈を 1 行に短縮（<br> 削除、文言も簡潔化）
- ui(admin): 氏名 input の背景を bg-stone-50 → bg-white に統一
- ui(admin): TDEE と PFC 割合（自動計算カラム）の背景を bg-stone-50 → bg-white に統一、枠線も他と統一
- ui(admin): 「目標カロリー・PFC（自動計算、手動編集可）」見出しテキストを削除（grid 内のラベルで意味が伝わるため）
- ui(admin): PFC 割合のラベルを「タンパク質の割合」→「目標タンパク質 (%)」形式に変更（左隣の input ラベル「目標タンパク質 (g)」と統一）
- ui(admin): 希望のプラン下の計算式バッジを削除
- ui(admin): 残日数バナーに「計算式: kcal ±N / タンパク質 X g/kg・脂質 Y%」を併記（プラン選択時のみ表示）。目標達成日無しでもプラン選択時にバナーが表示される
- 影響範囲: /admin/customers/{[id]|new}（/store も自動反映）

## 2026-05-17 (staging) – LINE ユーザーID 編集を admin 専用に
- security(admin): /admin/customers/new の LINEユーザーID 入力フィールドを **admin URL でのみ表示**（usePathname で /admin/* 判定）
- /store/customers/new からアクセスすると LINEユーザーID フィールド自体が**非表示**になり、店舗スタッフが手動で書き換えられないようにした
- [id] 編集画面では既に Field component の読み取り専用表示のため変更不要
- 影響範囲: 管理画面 /admin/customers/new と /store/customers/new

## 2026-05-17 (staging) – 顧客フォーム UI 改修（アイコン削除・TDEE表示・PFC割合）
- ui(admin): /admin/customers/new と /admin/customers/[id] 共通改修
  - LINEユーザーID ラベルから「（任意）」削除
  - 身体情報セクションの注釈を「性別・年齢・身長・現在体重・活動レベル・希望のプラン」の順に統一
  - 入力フィールドラベルの lucide-react アイコンを全削除（セクション h2 アイコンは維持）
  - 未使用 import（User/MessageCircle/BadgeCheck/Store/PersonStanding/Cake/Ruler/Activity/Flame/Droplet/Wheat/Scale ほか）を削除
  - 希望のプランの選択肢から括弧表記を削除し、選択中プランのロジックをバッジで動的表示
  - 目標セクションのレイアウトを改修: 目標体重・達成日 → 消費kcal・目標kcal・PFC×割合 の順に変更
  - 目標カロリー/PFC を 2列×4行グリッドに再設計（左: 編集可能 input、右: 読み取り専用）
  - 「現在の1日あたり消費カロリー（TDEE）」表示セルを追加（stone-50 背景の読み取り専用）
  - PFC 割合（タンパク質・脂質・炭水化物）を goalKcal と goalP/F/C から自動計算して表示（goalKcal=0 時は「—」）
  - [id] ページ: calcMifflin の返り値に tdee を追加し、身体情報変更時に TDEE を更新
- 影響範囲: 管理画面（/admin/customers/new、/admin/customers/[id]）

## 2026-05-17 (staging) – ステータス再変更
- chore: 食事管理ステータスの方針を再変更（「申込中」廃止 → 「設定中」一本化）
  - 前回（同日早朝）「設定中」→「申込中」一本化したが、業務的に「設定中」が適切と判断し戻し
  - Notion DB（staging/本番）の options から「申込中」を削除、既存「申込中」顧客 4件（組山・北脇・亀山・後藤）を「設定中」へマイグレ（notion-ops 経由）
  - コード側: STATUS_OPTIONS / 新規追加デフォルト / /api/admin/customers POST デフォルト / /api/onboard/redeem 自動切替対象 / lib/notion.ts createTenantCustomerDb / /admin/page.tsx の StatusBadge と STATUSES と「承認する」ボタン条件 すべて「申込中」→「設定中」に置換
  - redeem の自動切替動作: 設定中 → 進行中（LINE認証成功で発火）
- 影響範囲: DB 共通 / 管理画面 / API

## 2026-05-17 (staging) – UI改修フォローアップ3
- ui(admin): 顧客編集画面 /admin/customers/[id] 改修
  - 「身体プロフィール」→「身体情報」にリネーム
  - 希望のプランを活動レベルの隣（grid-cols-2）に横並び配置
  - 注釈を6項目揃うと自動計算される旨の文言に差し替え
  - 目標 kcal/PFC を grid-cols-4 でモバイルでも常に4列表示
  - 全ラベルに lucide-react アイコン追加（User/MessageCircle/BadgeCheck/Store/PersonStanding/Cake/Ruler/Scale/Activity/Target/Flame/Droplet/Wheat）
  - ラベル text-[10px]→text-xs、text-xs→text-sm、input/select text-sm→text-base、h2 text-sm→text-base
  - LINE ユーザーID の mono フォント削除、氏名と統一
  - 保存成功時のインラインバナー（saveMsg）を削除、即 router.push(\`\${base}?saved=1\`) で顧客一覧へ遷移
- ui(admin): /admin/customers/new も同等の改修（身体情報リネーム・2段レイアウト・4列PFC・アイコン・フォント・遷移）
- ui(admin): /admin/page.tsx に保存完了スナックバー追加（saved=1 クエリ検知→emerald-600 固定バナー→4秒後 URL クリーンアップ）
- 影響範囲: 管理画面 /admin/customers/{[id]|new|（一覧）}（/store/customers/* も自動反映）

## 2026-05-17 (staging) – Basic Auth 保護
- security: staging.fitmeal.jp および *.vercel.app (Preview URL) を HTTP Basic Auth で保護
  - `proxy.ts` に `isStagingHost` / `checkBasicAuth` を追加
  - 環境変数 `STAGING_BASIC_AUTH_USER` / `STAGING_BASIC_AUTH_PASSWORD` が未設定の場合は素通し（フォールバック）
  - 例外パス: `/api/cron/*`（Vercel Cron）、`/_next/static/*`、`/favicon.ico`
  - 素通しホスト: `app.fitmeal.jp`、`fitmeal.jp`、`www.fitmeal.jp`、`localhost`
  - matcher を `/(.*)`（全パス）に拡張（既存の admin/store セッション認証と共存）
- feat: `app/robots.ts` を動的生成に変更
  - staging / preview ホストでは `Disallow: /`、本番 `app.fitmeal.jp` では `Allow: /`
- 影響範囲: staging 環境のみ（main / 本番への影響なし）
- 関連: `STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASSWORD` を Vercel に追加要（下記参照）

## 2026-05-17 (staging) – フォローアップ2
- ui(admin): 顧客編集画面 /admin/customers/[id] 改修
  - 「体型・代謝」セクションを「身体プロフィール」にリネーム
  - 「目標プラン」を身体プロフィールセクションへ移動、ラベルを「希望のプラン」に変更
  - 各プラン option に PFC 計算ロジックを併記（例: 減量 kcal -500 / P 2.2g/kg・F 20%）
  - 「🧮 目安を自動計算」ボタンを削除、useEffect でリアルタイム自動計算（身体プロフィールが揃った瞬間に目標値へ反映）
  - ステータス select から `<option value="">未設定</option>` を削除
  - 「各種遷移」セクション（レポートを送る・AI分析を見る）を削除
- ui(admin): /admin/customers/new も同等の改修（身体プロフィール再構成・希望のプラン inline option化・リアルタイム計算・自動計算プレビューブロック削除）
- 影響範囲: 管理画面 /admin/customers/{[id]|new}（/store/customers/* も自動反映）

## 2026-05-17 (staging) – フォローアップ
- feat(admin): 顧客編集画面 /admin/customers/[id] に「危険な操作（管理者専用）」セクションを追加。オンボーディングリセットボタンを admin URL でのみ表示（usePathname で /admin/* 判定。/store/* では非表示）
- feat(lib): goalCalc.ts の PLANS を 4種化（減量/増量/筋肥大/現状維持）。calcGoals のプラン補正と PFC 比率を 4種対応に拡張。ACTIVITY_LEVELS に displayLabel 追加（DB保存は label のまま）
- fix(admin): /admin/customers/new デフォルト foodStatus を「申込中」に。STATUS_OPTIONS から「設定中」削除
- fix(api): /api/admin/customers POST のデフォルト「設定中」→「申込中」
- fix(api): /api/public/apply の plan「維持」→「現状維持」
- fix(lib): createTenantCustomerDb で食事管理ステータスから「設定中」除去、プラン options を 4種に変更
- chore: 診断 /api/debug/tenant 削除
- 影響範囲: 管理画面 /admin/customers/* + 新規テナント自動プロビジョニング先のスキーマ
- 関連: notion-ops で本番＋staging の顧客DBスキーマも更新済み（設定中 option 削除・プラン options 差し替え）

## 2026-05-17 (staging)
- feat(admin): 顧客編集画面リファクタ（セクション再構成・自動計算ボタン・保存通知）
  - STATUS_OPTIONS から「設定中」を削除 → ['申込中', '進行中', '休止中', '卒業']
  - 「体型・代謝」セクションに現在体重フィールドを追加（性別/年齢/身長/現在体重/活動レベルの順）
  - 「目標」セクションを目標プラン/kcal/PFC/目標体重/目標達成日に再編
  - 目標プランを 減量/増量/筋肥大/現状維持 の4種に変更
  - 活動レベルの表示ラベルを拡張（DB値はそのまま）
  - 「🧮 目安を自動計算」ボタン追加（Mifflin-St Jeor + プラン別補正で goalKcal/PFC を流し込む）
  - 保存成功時にインラインバナー表示 + 1.5秒後に顧客一覧へ遷移
  - 食事記録リンク・運動記録リンク・オンボーディングリセットボタンを画面から削除
  - 全 required 撤廃（未記入でも保存可）
  - currentWeight を PATCH 可能に（lib/notion.ts・lib/repository/customers.ts・API route 追加）
- 影響範囲: 管理画面 /admin/customers/[id]（/store/customers/[id] は re-export のため自動反映）

## 2026-05-16 23:45 (staging)
- 修正: app/page.tsx で liff.state クエリパラメータを保持して redirect。LIFF v2 では LIFF URL のパス・クエリが /?liff.state=... 形式で渡されるため、これを破棄せず転送先 path として使う。これにより招待リンク liff.line.me/{id}/onboard?token=xxx が正しく /onboard?token=xxx に転送される
- 影響範囲: 顧客側 LIFF 全般（招待リンク・通知リンク・LIFFのpath付きdeep link）
- 関連: staging テスト次郎 招待リンクが /home に着地して「顧客が見つかりません」エラーが出ていた

## 2026-05-16 23:30 (staging)
- 診断: /api/debug/tenant を追加（一時的）。staging 招待リンク 404 の原因切り分け用に env と getCurrentTenant() を返す
- 影響範囲: staging のみ（main 未マージ）

---

## 2026-05-17 緊急修正（営業中バグ・main直push）
- ⚠️ **緊急修正**: /api/extras から `customer.currentWeight` フォールバックを削除
- 症状: 顧客が「今日の体重」を未入力でも、顧客DBの過去最終体重が「今日の体重」として表示されていた（営業中に発覚）
- 原因: app/api/extras/route.ts:50-52 の `if (!extras.weight && fallbackWeight) extras.weight = fallbackWeight;` ロジックが、過去の体重を「今日の値」として返していた
- 元の意図: GAS 経由の個人シート反映遅延に備えたフォールバックだったが、ユーザー視点で「未入力 = 表示なし」であるべき
- 影響範囲: 顧客側 LIFF /home の体重入力欄
- 関連: AGENTS.md 緊急バグ修正例外条項を適用（staging 経由せず main 直 push）

---

## 2026-05-16 10:00 a102dc7 (現在の本番)
- ⚠️ **緊急ロールバック (2回目)**: 体重登録が動作しなくなったため、`a102dc7` (2026-05-15 18:06) まで戻した
- 失われた機能はすべて `backup-2026-05-16-am` ブランチに保存（cherry-pick で復活可能）
- 失われた主な機能:
  - 招待リンク・申込フォーム・LINEワンクリック送信
  - オンボーディング・プロフィール・お知らせメニュー
  - レポートテンプレ標準化（絵文字あり/なし）・対象期間・並び順・複製
  - 食事区分グラフ・AI分析強化（食材アドバイス）・体重履歴・運動DB
  - モバイル対応・写真URL共有・Vercel Analytics
  - 様々なバグ修正（前日レポート0値、オンボ固まり 等）

## 2026-05-16 朝 (失われた変更群)
- 上記参照、すべて backup-2026-05-16-am にて保存

## 2026-05-15 18:06 a102dc7
- 食事補正の0プレフィックス修正
- /store のフッターナビ削除

---

# 過去全コミット履歴（自動生成）

`git log` から日付別にまとめた完全履歴。新規追加時はトップの「ロールバック記録」セクションに追記し、毎日のコミットはここに自動蓄積される想定（今後 GitHub Actions で生成可）。

## 2026-05-12
- `84a8ad7` 18:11 — Initial commit from Create Next App
- `ccb4a63` 18:22 — 食事記録LIFFアプリの初期実装
- `250c300` 18:27 — rename package to mewodas-liff
- `df0e316` 18:42 — LIFF→GAS連携: APIレスポンス形式に合わせて ok/pfc を扱うよう修正
- `bccf67b` 18:49 — UI改善 + 写真任意化
- `dd43a26` 18:57 — GASバイパス + 複数枚画像対応
- `55a6a12` 19:05 — 精度向上 + Drive非同期保存 + UIラベル改善
- `bfabaaf` 19:09 — Gemini堅牢化：マークダウン除去/トークン拡張/リトライ+フォールバック
- `d923d25` 23:43 — LIFF 閉じるボタン堅牢化
- `3bdf08d` 23:49 — 明示量メモ時はPFC補正を無効化（精度向上）
- `9e79f30` 23:55 — 画像クライアント圧縮で送信エラー解消

## 2026-05-13
- `49ff9f0` 00:01 — 複数枚画像の並列処理化 + 食材メモ改善
- `5e1258b` 00:05 — Geminiフォールバックモデル修正 + 並列数制限
- `1fd1c4a` 00:10 — エラー詳細を可視化して原因特定しやすく
- `404dc89` 00:14 — 高速化：全並列化 + 画像サイズ縮小
- `4d2fbdf` 00:16 — 画像圧縮を1280px/0.85に戻す（精度優先、並列化で速度は確保）
- `632b675` 00:20 — Geminiフォールバックを gemini-2.5-flash-lite に変更（新規アカウント対応）
- `bf92998` 00:26 — FileReader→FormDataに変更で再送信エラー解消
- `334d611` 00:33 — Geminiのresponse schemaでitems配列を必須化（食材内訳が空にならないように）
- `3187049` 00:36 — responseSchemaの型名を大文字化（Gemini REST APIの正しい形式）
- `7ca7e3e` 08:47 — items配列を必ず非空で返すようプロンプト強化
- `7cfce98` 08:58 — 責任スキーマ除去 + 食材メモを明示的に併記 + デバッグログ追加
- `af360a7` 09:39 — プライマリモデルを gemini-2.5-flash-lite に切替（速度優先）
- `eea53e2` 09:52 — プライマリを gemini-2.5-flash に戻す（精度優先）
- `dc1ea54` 10:00 — 明示量メモ+写真の両方をitems配列に必ず含める
- `8952d9e` 10:03 — 明示量メモ+写真は完全分離して並列解析→合算する設計に変更
- `d4478c7` 10:14 — PFC値の変動を低減：temperature を 0.4→0.1 に下げて確定性向上
- `7679fba` 10:34 — Phase 2: マイホーム画面実装
- `1dfb5fe` 10:45 — 食事写真サムネイル表示：Google Drive URL を画像URL形式に変換
- `fe89be4` 10:49 — 各食事の合計PFCと1日内シェアを表示
- `076a478` 10:55 — Phase 3-1: 週次レポート画面実装
- `7e05bd8` 10:58 — キャッシュ無効化 + ホーム画面に手動更新ボタン追加
- `1a3aeeb` 11:04 — Phase 3-2: 履歴カレンダー実装
- `bf2bff8` 11:14 — ホームの日付ナビ+フッターナビ+高速化+履歴連携
- `cdec484` 11:27 — PFC画像補正係数を0.55→0.8に緩和（P/F値が低く出る問題対応）
- `471cf14` 11:32 — PFC補正撤廃 + クライアントキャッシュで体感速度大幅向上
- `086d5b0` 13:36 — ダブルカウント修正・削除機能・履歴グラフ・未来ナビ除去
- `0543dfe` 13:54 — 履歴UI改善 + 週次グラフに平均ライン追加
- `c2884d6` 14:28 — 体重・運動 個別入力フォーム追加（3形式：食事・体重・運動）
- `53dea2e` 14:35 — 記録メニュー画面 + フッターナビから3形式を選択可能に
- `2432862` 14:45 — LIFF/Notion両方で表示+運動列名+食事記録セクション名を整理
- `49808a7` 14:57 — 週次サマリ・履歴に運動データ統合
- `c8a127e` 15:05 — 履歴カレンダーの運動マーク改善 + キャッシュキー更新
- `4c190f6` 15:13 — 体重・運動記録をwaitUntilで非同期化（5〜15秒→即時応答）
- `6881a26` 15:20 — 記録ボタンをボトムシート化＋週次グラフのツールチップ削除
- `134e6ff` 15:26 — 週次グラフ: バーをタップで日別カロリー表示・オレンジ枠抑制、ホームの記録ボタン削除
- `4d9ac16` 15:32 — 週次グラフをCSSベースで自前実装、目標/平均を凡例付きで明記
- `bf1b542` 15:36 — 週次グラフ: 選択日表示を削除、凡例の文字を大きく
- `5a7606d` 15:44 — Phase5: 残りカロリー逆算サジェスト機能を追加
- `8120160` 15:47 — 食事提案の数値を推定値として明示
- `dfeb250` 16:22 — Phase6: トレーナー俯瞰画面を追加
- `81ed200` 16:31 — Phase6: 4機能を一括追加（ワンタップ記録/月次サマリ/継続バッジ/PWA）
- `16f7493` 16:39 — 継続バッジと月次サマリから「目標達成」指標を削除
- `89e6b8a` 16:45 — バッジ・月次サマリのラベルを意味が分かる表記に変更
- `185065b` 16:52 — 継続バッジに「次のバッジまであとX日」を追加
- `f941fdb` 16:54 — 「次のバッジまで」表示を削除
- `4489d4f` 18:22 — スケーラビリティ準備：テナント分離+AI修正データ収集
- `6377eca` 18:55 — 価格段階制+体重予測AI追加（カロミル対抗）
- `10130e6` 19:04 — AI食事相談チャット+詳細栄養素表示を追加
- `90ba705` 19:22 — 栄養素過剰/不足ラベル+ホームUI刷新
- `d701367` 19:35 — AIチャット応答が途中で切れる問題を修正

## 2026-05-14
- `33462ac` 00:18 — 食事記録UI刷新+多機能追加（ホーム/記録/マイメニュー/食品DB/予測 等）
- `9959db5` 00:22 — 食事解析：写真+補足メモの両方を確実に加味するプロンプト強化
- `a41fd4e` 00:31 — 食品DB増量+表記統一+写真メモ補完精度向上
- `abe25b7` 00:47 — 食事解析プロンプト強化+食品DBを2000件超に増量
- `b7c4f40` 08:05 — マイメニュー編集機能を追加
- `8b39601` 08:09 — 食品DBをカート方式に変更（複数選択→一括記録）
- `41d7c1a` 08:14 — メニュー配下機能のヘッダーUIを統一
- `a25a081` 08:20 — 体重・運動の上書き保証+ホームから直接入力
- `2f475ef` 08:24 — 食品DB：カート追加後は±ボタンで数量調整、誤連打防止
- `f8e4b3e` 08:26 — PageHeaderを緑背景（ホームの日付選択中と同系色）に統一
- `87069a1` 08:28 — 食品DB：日付・食事区分セレクタの sticky 位置を解除
- `e83e760` 08:33 — 記録系ページのヘッダー統一+その他UI調整
- `e8a0a8a` 08:36 — 緑色を emerald-600 に統一+挨拶サイズ調整
- `bff3b8c` 08:41 — ボトムシートにドラッグ操作対応+緑色をemerald-500に戻す
- `d71a1c0` 08:46 — AI献立をデフォルト1食モードに変更（食事区分を選択+残りPFCから3案）
- `cbd52d8` 08:47 — ホーム挨拶のフォントを text-base → text-sm に縮小
- `e6111ca` 08:54 — AI献立：ホームで開いている日付に記録できるように
- `ffedc48` 08:59 — AI献立に日付選択UIを追加（画面内で過去日付に変更可能）
- `3d7ff0d` 09:09 — 写真解析確認画面の編集機能+食材ごとに個別記録
- `22e224d` 11:39 — 運動入力をテキスト欄のみに変更（書けば「した」、空なら「してない」判定）
- `7c48ab3` 11:47 — 記録系で過去日付に対応（カレンダー日付→そのまま記録できる）
- `0c12f32` 11:52 — ホーム日付ストリップを「過去14日+今日+未来7日」に拡張+今日が中央に表示
- `40ce55e` 11:53 — 運動表示から「した/なし」ラベルを削除、テキスト内容のみ表示に
- `5631cab` 11:54 — 日付ストリップ：未来日の薄い表示を解除して過去・今日と同じ見た目に
- `0058e92` 11:56 — 日付ストリップに左右の矢印ボタンを追加（スクロール可視化）
- `1cb1d8f` 11:57 — 食事記録の日付セレクタ：今日/昨日ボタンを矢印に置換
- `e2493f4` 11:57 — 食事記録の日付セレクタ：カレンダーを📅アイコン化
- `dca9801` 11:59 — 日付ストリップの矢印を日程と被らないよう横並びに修正
- `9d56440` 12:02 — 食事記録の日付UI：中央寄せ修正+📅を日付ラベルに統合
- `712e76f` 12:03 — 日付ストリップ：今日のセル中央表示の計算を正確に
- `77c684c` 12:06 — FooterNav の「記録」を食事記録ページに直接遷移
- `b4bf1fb` 12:08 — ホーム今日の記録：体重・運動カードを同じ幅・同じ高さに揃える
- `4e8ea37` 12:09 — 記録ボタンの文言を「食事記録」に統一
- `11db2e5` 12:11 — ホームで過去日を選んだ時も体重・運動を記録できるように
- `644118a` 12:18 — 履歴ページ強化：月次サマリ拡張+当日初期表示+体重運動カード
- `b19cd93` 12:22 — ホーム：過去日選択時もバッジ（連続記録日数）が消えないように
- `f802d35` 12:23 — 食事記録：未来日にも記録できるように制限解除
- `7943d5e` 12:27 — ホーム改善：未記録食事のボタン群を集約+食事割合の円グラフ追加
- `93c7007` 12:33 — 週次・履歴に統一サマリ+食事区分割合の円グラフ追加
- `beb8a72` 12:38 — 食品DB/マイメニューの日付UI改修+円グラフに総カロリー表示
- `594cd13` 12:41 — 食品DB：記録完了画面の追加+カゴアイコン→食事アイコンに変更
- `aee2475` 12:46 — 編集UI調整：PFC自動計算をデフォルトON+鉛筆アイコンをテキストボタンに
- `1d3f7e5` 12:54 — 成分表登録に手動補正機能を追加（OCR結果を編集可能）
- `ad3611d` 12:58 — オンボーディングツアー機能を追加（テックタッチ）
- `f41e83c` 13:05 — 絵文字→アイコン化 第1弾：lucide-react導入
- `b395b6c` 13:08 — オンボーディングをアクション型に再設計+食事記録閉じるボタン削除
- `1107df6` 13:14 — ホーム画面を全面アイコン化（lucide-react）
- `0b507fa` 13:35 — 全ページのヘッダー絵文字をlucideアイコンに統一
- `5d8cc13` 13:45 — 絵文字→アイコン化 第3弾：履歴・食事記録の内部UI＋円グラフ
- `40c899a` 13:49 — 絵文字→アイコン化 第4弾：マイメニュー・週次レポート
- `da1a307` 13:56 — 絵文字→アイコン化 第5弾：badges/food-search/exercise/weight/chat/home残り
- `f60fda7` 13:59 — 絵文字→アイコン化 第6弾：体重・運動・予測・AI相談
- `e7a42b6` 14:09 — 絵文字→アイコン化 最終：meal-plan/meal-detail/scan/record-menu/badges/home残り
- `e1db632` 14:13 — 「食べなかった」を🚫絵文字に戻す（赤系のため目立つ）
- `1904d8a` 14:16 — Star色を統一+運動アイコンをDumbbellに変更
- `69a220a` 14:25 — 食材編集に「人前倍率」追加+運動アイコン変更+Star色明示
- `6208dab` 14:51 — 完了ボタン削除/PFC自動計算統一/運動入力リスト化/UI微調整
- `21accfa` 15:05 — 全シートに下スワイプで閉じる機能を統一適用
- `9631495` 15:15 — AI補正で他アイテムが変わる問題を修正
- `9735f9f` 15:16 — ホームの運動表示を line-clamp-2 + whitespace-pre-line に戻す
- `8222256` 15:31 — 運動表示で旧 / 区切りデータも改行として扱う
- `3d04168` 15:40 — 管理者画面（Phase 1A）を新設：顧客一覧・詳細編集・記録修正
- `eee6e0b` 17:54 — ホーム栄養サマリー右上の「X% 達成」を削除
- `499eb01` 17:56 — 体重の増減 下の補足テキスト Scale アイコンに sky-600 色を付与
- `ac3df5e` 18:19 — clientCache を localStorage 永続化（初回ロード高速化）
- `da7140d` 18:22 — admin: 未設定顧客を除外+デフォルト「進行中」フィルタ+管理画面でFooterNav非表示
- `97e9cdc` 18:36 — admin: 「食事管理」タブを追加（全顧客横断の食事一覧）
- `94c5835` 18:37 — シートを下ドラッグ閉じる専用に簡素化（全画面化を撤去）
- `55e5a93` 19:03 — admin Phase 1B: 通知/レポート送信 + 顧客通知LIFF + 顧客AI分析タブ
- `ab2daf4` 20:55 — admin: meals UI 改修(単日+矢印+食事区分+グループ写真伝播)、食事記録リンク削除、レポート/分析タブ追加 (進行中)
- `a9c05eb` 21:05 — docs: ステージング/本番環境セットアップ手順書を追加
- `5623f38` 21:09 — admin: スタッフ・テンプレ管理 + AI自動レポート生成 + 上位タブから一発作成
- `9253841` 21:13 — FitMeal フルブランディング適用
- `a0ea46d` 21:28 — admin: スタッフタブ追加、日付UIを常時範囲表示+共通化、テンプレをベースにAI補完
- `71a9c92` 22:52 — admin: 目標値自動計算+AI分析グラフ化+FitMeal顧客DB分離
- `161d729` 22:55 — fix: recharts Tooltip formatter の型エラーを修正

## 2026-05-15
- `0352977` 00:02 — admin: テナント自動プロビジョニング機能を追加
- `77ff8ce` 00:15 — admin: マルチテナント基盤（Phase 3a-1）
- `7d16e26` 00:21 — admin: 顧客・食事・レポート系ルートに withAdminTenant 適用（Phase 3a-2）
- `fa6a327` 00:37 — admin: テナント詳細編集UI + スタッフDB自動セットアップ + 残ルートwrap
- `4e7951c` 08:49 — fix: withTenant ラッパーの Notion アクセス失敗時にフォールバック
- `d62f531` 09:42 — admin: スタッフ→店舗にデータモデル変更（複数店舗対応）
- `f61e7d6` 10:34 — admin/store: 店舗側管理画面 (/store) を新設
- `9701ed3` 10:42 — admin/store: 顧客新規追加機能、テナント切替UI削除
- `9652bf9` 10:44 — home/予測ロジック/日付UI 改善
- `2e86596` 10:45 — admin: 顧客詳細に送信履歴＋食事記録リンクを追加
- `afb0cef` 12:28 — fix: /api/today に Notion 呼び出しタイムアウト追加（504対策）
- `60944e3` 12:37 — perf: 初回ロード短縮 + 削除高速化
- `3eca484` 12:45 — ux: ホームの日付切替でリロード感を消す（fadeトランジション）
- `cdc7a02` 12:49 — ux: 日付切替中のあすけん風ローディングインジケーターを中央表示
- `ab91018` 13:44 — ui: ホーム左上の日付を大きく目立たせる（text-[11px] → text-base font-bold）
- `c1f93fd` 13:50 — fix: 体重予測をプロトレーナー水準に + 左上日付の縦中央揃え
- `366d60c` 14:01 — ux: ホームヘッダー sticky 化 + 上余白を詰める（あすけん風）
- `42fa87c` 14:12 — ui: メニュータイトルにアイコン + PageHeader高さ統一 + 体重予測信頼度ロジック明確化
- `9b15093` 14:30 — ui: 食事記録など各ページに subtitle 追加 + 週次/月次にローディング + 月次に日付ストリップ
- `25fe11d` 14:45 — fix: ダークモード自動切替を無効化（モバイル真っ黒画面の修正）
- `b1be6a0` 15:34 — admin: 店舗をナビから外し、テナント詳細内のサブ機能に格納
- `f19f374` 15:50 — store: 店舗タブを /store に追加・店舗作成を名前のみで完結
- `efbe568` 16:30 — admin/store: Tenant admin 認証 + パスワード発行UI + /store PWA化
- `a0bf560` 16:45 — auth: ログインバグ修正 + ユーザー側パスワード変更 + メール自動送信
- `9480a07` 17:08 — chore: env 追加（RESEND_API_KEY / EMAIL_FROM）反映のため再デプロイ
- `8baf86e` 17:47 — auth: パスワード再設定フロー + 新規テナント時の自動メール + UI簡略化
- `5898e95` 17:58 — admin/store: 食事PFC補正UI + 補正者トラッキング + AI学習データ抽出
- `a102dc7` 18:06 — fix: 食事補正の0プレフィックス + /store のフッターナビ削除

## 2026-05-16
- `b373e3c` 09:41 — feat(ops): GitHub-based safety net for change management
