# CHANGELOG

機能追加・バグ修正・ロールバックなどの履歴を記録する。

形式:
```
## YYYY-MM-DD HH:MM commit-sha
- カテゴリ: 内容
- ⚠️ ロールバック: 戻した先 と 理由
```

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

## 2026-05-18 – 契約管理機能（席数管理・新プラン構造・招待上限ブロック・増減枠UI）

- 機能: 新プラン構造（Starter/Growth/Scale）+ サポート費¥5,000固定 + per-user 2段階Subscriptionに移行
- 機能: `lib/seats.ts` 新規作成（60秒キャッシュ付きの席数ステータス集約）
- 機能: `lib/stripe.ts` 全面書き換え（旧 unitPriceFor 等を削除し、新プラン関数に置換）
- 機能: `lib/notion.ts` の TenantRow 型 + listTenantRows + updateTenantRow に `seatLimit`/`planTier` 追加
- 機能: `/api/stripe/checkout` を 2 line_item 構造（サポート費 + per-user）に改修
- 機能: `/api/stripe/webhook` を per-user item の quantity → seatLimit 同期に改修（旧契約スキップ）
- 機能: `/api/stripe/preview-seats` 新規作成（日割り差額プレビュー）
- 機能: `/api/stripe/update-seats` 新規作成（席数変更確定・減枠ガード付き）
- 機能: `/api/admin/billing/info` に seatLimit/currentSeats/isOverLimit/isNearLimit 等を追加
- 機能: `/api/admin/customers/[id]/invite-link` に席数上限チェック（isOverLimit → 403）追加
- 機能: `/api/admin/customers` POST に席数上限チェック追加・作成後 seatCache invalidate
- UI: `/admin/billing/page.tsx` を契約状況メイン（進捗バー・増減枠ボタン）に大幅改修
- UI: `/admin/billing/SeatChangeModal.tsx` 新規作成（席数変更モーダル・日割り差額表示）
- UI: `/admin/page.tsx` に席数上限バナー + 招待リンクボタン disabled 対応
- UI: `/admin/customers/new/page.tsx` に席数上限ブロック + バナー表示
- 影響範囲: 管理画面 / API（admin・stripe） / Notion DB（テナント管理）
- ブランチ: feat/seat-management-and-new-pricing
- 関連計画: /home/mwds/.claude/plans/curious-brewing-salamander.md

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

- fix(app/home): 1枚の写真から複数食材が判定された場合、ホーム画面の食事カードに同じ写真が複数並んでいた問題を修正。`imageUrl` で重複排除し、ユニークな写真のみ表示
- 影響範囲: 顧客側（ホーム画面の食事カード下部のサムネイル列）。食事詳細ページのサムネイル表示は従来どおり全枚数を表示

## 2026-05-18 (staging) – Gemini プロンプトを「写真主体・メモは参考値」に変更

- feat(lib/gemini): 食事推定プロンプトのスタンスを切り替え。これまで「量明示メモ最優先」だった挙動を「写真主体・メモは参考値」に変更。メモの量明示（「100g」「1杯」等）は参考扱いで、写真と近ければ採用、ずれていれば写真優先
- 修飾語（ノンオイル等）の反映と、写真に映ってない料理の追加申告は引き続き採用
- 影響範囲: 顧客側 LIFF /record（推定値の挙動）
- 背景: 教科書値ベース計算で全体的に高く出ていた問題を、画像認識主体の推定で実態に近づける狙い。補正係数による事後補正と併用

## 2026-05-18 (staging) – PFC キャリブレーション: items 配列にも係数を適用

- fix(lib/gemini): `parsePfcJson` で合計 P/F/C のみに calibration を掛けていたが、items 配列の各品目には掛かっていなかった。`/record/analyze` の画面表示は items を表示するため、社長視点では補正が効いていないように見えていた
- 修正: items 配列の各 P/F/C にも calibration を乗算し、合計と表示値の整合性を維持
- 影響範囲: 顧客側 LIFF /record（画面表示の P/F/C 値）

## 2026-05-18 (staging) – PFC キャリブレーション: withLiffTenant ラッパー追加でテナント解決を修正

- fix(api/record, api/record/analyze): `withLiffTenant` でラップ。これまでテナントコンテキスト未設定のため `getCurrentTenant()` が静的 MEWODAS にフォールバックし、staging で `FITMEAL_TENANT_ID_OVERRIDE=mewodas-staging` を見ていなかった
- 影響範囲: 顧客側 LIFF（食事推定値の補正、staging で動作確認可能になる）
- 関連: 直前のキャリブレーション PR #1 の動作確認で発覚

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
