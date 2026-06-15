# CHANGELOG

## 2026-06-15 – feat(LIFF): ホームに「今日の備考」カード追加（日次1件の自由メモ / branch: staging）
- 新機能: ホーム画面「本日の記録（体重・運動）」カードの直下に「今日の備考」カードを追加。顧客が日付ごとに1件、自由テキストのメモ（体調・気づき・トレーナーへの連絡など）を保存できる。選択中の日付に追従（過去日も閲覧・編集可、未来日は非表示）。2000文字まで
- データ層: テナント別 Notion「日次備考」DB を新設（体重ログDBと同じ "1日1ユーザー1レコード upsert + 所有者スコープ" 方式）。`lib/repository/dailyNotes.ts`（getDailyNoteOnDate/upsertDailyNote/isDailyNoteEnabled、日付=title）。運動DBのような env グローバル直読みは踏襲せず、テナント分離を最初から担保
- 設定: FitMeal テナントDB に列「Notion 日次備考DB ID」を追加（`weightDbId`/`bodyCompDbId` と同方式）。`TenantConfig.notionDailyNoteDbId`・`TenantRow.dailyNoteDbId`・`tenantResolver`・`insertTenantRow`・`provisionTenant`（新規テナントは5DB目として自動作成）・`createTenantDailyNoteDb` を追加。DB 未割当テナントでは API が `enabled:false` を返しカードごと非表示（機能フラグ）
- API: `app/api/daily-note/route.ts`（GET=取得 / POST=upsert、`withLiffTenant` で検証済み本人にスコープ＝IDOR なし）。UI: `components/DailyNoteCard.tsx`（自己完結型・選択日変更で自取得・楽観 UI なしの確実保存）。`app/home/_components/LiffGate.tsx` に1ブロック追加
- provisioning: `scripts/provision-daily-note-db.mjs`（アプリと同じ Integration で DB 作成→アクセス権が確実に通る・冪等）。staging テナント済み。**本番テナントはオーナーの main マージ指示時に実行予定**
- 影響範囲: 顧客側 LIFF（/home）。Notion DB 新設＋テナントDB列追加（既存データ・既存スキーマへの破壊的変更なし）
- 検証: `tsc --noEmit`・`next build`・`vitest`（後述）

## 2026-06-15 – fix(LIFF): 体重/運動の表示ソース統一・ホーム体重消失・目標ペース日付ズレ・未認証PII（自律バグ掃討 / branch: staging）
- fix(データソース): `/api/day`・`/api/weekly`・`/api/meal-plan` の体重/運動の読み出しを個人シート（getDailyExtras/getRangeExtras）から各ログDB（getWeightOnDate/getExerciseOnDate/listWeightLogsByLineUser/listExerciseLogsByLineUser）に統一（weekly は DB∪シートの union）。個人シートを持たない顧客の「日次詳細の体重・運動」「週次の体重・運動」「献立提案の運動消費カロリー」が反映される（先日の today/history/predict-weight 修正の続き）。meal-plan は旧実装で日付フォーマット不一致により運動消費が実質常に0だった点も解消
- security(LIFF): `/api/exercise/estimate` を未認証→`withLiffTenant` 必須に変更。旧実装は body の lineUserId を使って任意ユーザーの currentWeight を返せる未認証 PII オラクルだった。体重は検証済み本人（verifiedLineUserId）のみ参照（当該エンドポイントは現状フロント未使用＝実害は限定的だが穴を閉じる）
- fix(UX): `app/home/_components/LiffGate.tsx` handleMealDeleted が /api/today の空 weight/exercise で上書きし、食事削除後にホームの体重・運動カードが消える不具合を修正（prev 値をマージ）。体重/運動の保存時に AI 予測キャッシュ（predict_）も無効化（home・/weight）
- fix(日付): `app/home/_components/GoalProgressCard.tsx` の残り週数/必要ペースを JST 0:00 基準の日数計算に修正（/goals ページと統一）。締切付近での1日ズレ・ペース不一致を解消
- 影響範囲: 顧客側 LIFF（/home, /weekly, /history の日次詳細, 献立提案, /weight）。**staging のみ**（本番反映はオーナーの明示指示後）
- 検証: `tsc --noEmit` クリーン、`vitest` 43件パス、`next build` 成功

## 2026-06-15 – fix(backend): IDOR防止・レポート体重ソース統一・LIFFエラー応答のJSON化（自律バグ掃討 / main直可）
- security(IDOR): `lib/repository/bodyComposition.ts` の updateBodyCompositionLog/deleteBodyCompositionLog に `assertBodyCompOwnership`（現テナントの体組成DB所属チェック）を追加。共有 Notion API キー下で raw pageId 指定により他テナントの体組成レコードを改竄/削除できる穴を塞ぐ（呼び出し: app/api/admin/body-composition POST/DELETE）
- fix(reports): `lib/notion.ts` getWeightBoundsInRange/getWeightAvgInRange/getLastWeightInRange に optional `lineUserId` を追加し、体重ログDB（優先）＋個人シート（補完）の union で算出（共有 helper buildWeightMapInRange）。`app/api/admin/reports/generate`・`app/api/cron/daily-reports` の foodSheetPageId ガードを外し lineUserId を渡す → 個人シートを持たない顧客でも週次/月次レポートの体重（開始/最終/平均/前週比）が正しく出る
- fix(infra): `lib/withTenant.ts` の withLiffTenant がハンドラ例外を throw していたのを JSON 500 応答に変更（withAdminTenant と統一）。try/catch の無い顧客ルート（exercise-log POST, account DELETE 等）で「Unexpected end of JSON input」を解消
- 影響範囲: API/バックエンド（管理レポート生成・cron自動レポート・LIFFエラー応答）。DB スキーマ変更なし
- 検証: `tsc --noEmit`・`eslint`（変更ファイル）クリーン、`vitest` 43件パス、`next build` 成功
- 経緯: オーナー不在中の自律バグ掃討（3観点の並行コード監査）。顧客側UIの修正は staging に別コミットで用意

## 2026-06-14 – refactor(LIFF): 運動記録の書き込みを運動ログDBに一本化（体重と同じ単一ソース化）（branch: staging→main）
- 変更: ホームの「運動した/しない」トグルの保存先を、旧 GAS/個人シートから **運動ログDB** に一本化。体重（`/api/log/weight`）と同じ「DB必須・GASミラーはベストエフォート」設計に揃えた。これで個人シートを持たない顧客でも運動が保存・表示される（＝運動の真実のソースがDBに統一）
- `lib/repository/exerciseLogs.ts`: `setExerciseFlagOnDate`（トグル→DBの簡易レコード upsert/archive）と `getExerciseOnDate`（読み戻し）を追加。`createExerciseLog` を空の `強度`/`種目カテゴリ`(select) でも作成できるよう修正（簡易レコード対応）。`種目` title は全 rich_text セグメント連結に変更（改行を含む複数項目の取りこぼし防止）
- `app/api/log/exercise/route.ts`: 書き込みを `setExerciseFlagOnDate`（必須）＋ `callGasSaveExercise`（ベストエフォート）の `Promise.allSettled` 構成に変更。`invalidate('')` を追加
- `app/api/extras/route.ts`: ホームの運動読み戻しを個人シート（`getDailyExtras`）から運動ログDB（`getExerciseOnDate`）に変更（体重 `getWeightOnDate` と並ぶ形）。未使用となった `getCustomerByLineId`/`getDailyExtras`/`isoToJpMd` の import を削除
- 簡易レコードの定義: 時間0・カテゴリ無し・強度無し。詳細運動ログ（`/api/exercise-log`）は触らず共存（既に詳細ログがある日は簡易を作らない・dedup）
- 影響範囲: 顧客側 LIFF（ホームの運動トグル保存・読み戻し、/history・/prediction の運動表示）。書き込み先の変更。DB スキーマ変更なし
- 検証: `tsc --noEmit` クリーン、`vitest` 43件パス、`next build` 成功。変更ルート（log/exercise・extras）は `eslint` クリーン。`exerciseLogs.ts` は既存 `weightLogs.ts` と同じ既存 `any`（notionRequest/pageToLog）警告のみでビルド非ブロッキング
- 関連: 「個人シート無しで運動を記録する顧客が居るか」調査の結論（本番運動DBが0件・書き込みがシート無し顧客で捨てられていた）への恒久対応

## 2026-06-14 – fix(LIFF): 運動記録が予測・履歴に出ない同種バグ修正（運動ログDBを併用）（branch: staging→main）
- fix: `app/api/predict-weight/route.ts`（運動日数）・`app/api/history/route.ts`（日別の運動有無）。運動の判定を、個人シート（`getRangeExtras`）だけでなく **運動ログDB**（`listExerciseLogsByLineUser`）との **和集合（DB日付 ∪ シート日付・DB優先の日付dedup）** に変更。判定方式は admin 分析（`app/api/admin/customers/[id]/analysis/data`）の既存実装に合わせた
- 原因: 直前の体重修正と同じ構図。詳細運動ログ（`/api/exercise-log` → 運動ログDB）が保存されているのに、予測の運動日数・履歴の運動アイコンは個人シートだけを見ていたため、個人シートを持たない顧客の運動が反映されていなかった
- 影響範囲: 顧客側 LIFF（/prediction 予測の運動日数、/history 履歴の運動有無）。運動データの**書き込み**経路は変更なし（ホームの「運動した」boolはGAS/個人シート、詳細ログは運動DBのまま）。DB・Notion スキーマ変更なし（読み出しロジックのみ）
- 非regression: 既存の個人シート参照に運動DBの日付を**足す**だけ（和集合）なので、個人シートを持つ顧客の表示は減らない
- 前提確認: 本番 Vercel env に `NOTION_EXERCISE_DB_ID` が設定済み（Production）であることを確認
- 検証: `tsc --noEmit`・`eslint` クリーン、`vitest` 43件パス
- 関連: 直前の体重修正（同日）のフォローアップ。残っていた運動側の同種潜在バグを解消

## 2026-06-14 – fix(LIFF): 体重推移グラフ・予測・履歴が表示されないバグ修正（読み出し元を体重ログDBに統一）（branch: staging→main）
- fix: `app/api/predict-weight/route.ts`・`app/api/history/route.ts`。体重の読み出し元を旧「個人シート（`getRangeExtras` / `foodSheetPageId`）」から、書き込みと同じ「真実のソース」である **Notion体重ログDB**（`listWeightLogsByLineUser`）に変更
- 原因: 体重の**入力**は `/api/log/weight` → 体重ログDB に保存され、ホーム現在体重（`/api/today` → `getLatestWeight`）も体重ログDBを見ているのに、**体重推移グラフ・予測**（`/api/predict-weight`）と**履歴の体重**（`/api/history`）だけが旧データ源の個人シートを読み続けていた。個人シート（`食事記録リンク`）を持たない顧客は推移・予測・履歴の体重が常に空になっていた（本番顧客11名中6名が個人シート無し）
- 影響範囲: 顧客側 LIFF（/prediction 体重推移・予測、/history 履歴の体重）。運動データは未移行のため個人シート参照のまま温存。DB・Notion スキーマ変更なし（読み出しロジックのみ）
- 副次: `predict-weight` の未使用 import（`isoToJpMd`）・未使用変数（`dateIsoMap`）を整理
- 検証: `tsc --noEmit`・`eslint` クリーン、`vitest` 43件パス。本番DBで中西彩音さんのデータをシミュレートし、推移グラフが12点（58.2→56.8kg・予測実行条件の7点以上）／履歴6月12件マッピングされることを確認
- 関連: 中西彩音さんからの「体重の推移が反映されない」報告。体重ログDBへの紐づけ自体は正常だった（紐づけ問題ではなく読み出し元の不整合）

## 2026-06-09 – feat(admin): レポート作成のテンプレ別に作業状態（生成・編集内容）を記憶
- feat: `app/admin/reports/page.tsx`。テンプレチップを「タブ」のように扱い、テンプレごとに作った内容（生成結果・手動編集・タイトル・対象期間）を保持。別テンプレに移ると現在の内容を退避し、戻ってきたら復元する
- 挙動: 週次で文章生成 → 月次に移ると月次の素のひな形（未操作のため）→ 週次に戻ると先ほど生成した内容が復元される。未操作のテンプレに移ったときだけ素のひな形＋既定の対象期間を表示。同じチップの再クリックは何もしない（内容を消さない）
- 実装: `selectTemplate()` 内で `draftsRef`（templateId→{title,body,from,to} のマップ）に退避／復元。直前の「常に素へリセット」挙動（同日の前エントリ）を置き換え。保持はセッション内のみ（リロードでクリア）
- 影響範囲: 管理画面／店舗画面のレポート作成UI（/admin/reports・/store/reports）。API・DB・Notion テンプレデータ変更なし
- 検証: `eslint`・`tsc --noEmit` クリーン

## 2026-06-09 – fix(admin): レポート作成でテンプレ切替時に生成済み本文が残るバグ修正
- fix: `app/admin/reports/page.tsx`。テンプレチップを切り替えたとき、直前に「文章を生成」した本文（や手動編集）がそのまま残ってしまう問題を修正。横のテンプレに移ったら、そのテンプレの**未生成（素）のひな形**（タイトル・本文・対象期間）が表示されるようにした
- 原因: テンプレ切替を `useEffect` 内で「ユーザー編集なら上書きしない」ヒューリスティックで処理していたため、生成済み本文が "編集済み" と判定され切替先に引き継がれていた
- 修正内容: 切替処理を `selectTemplate(t)` イベントハンドラに集約（onClick で実行）。`useEffect`／`templateBaselineRef` を廃止。テンプレ選択時は常に素のひな形へリセットし、生成・編集済み内容は破棄。「テンプレなし」選択時は本文に触れない（別画面からの下書き流用・手動入力を保持）。初期表示の先頭テンプレ展開も同ハンドラ経由に統一
- 影響範囲: 管理画面／店舗画面のレポート作成UI（/admin/reports・/store/reports）。API・DB・Notion テンプレデータ変更なし
- 検証: `eslint`・`tsc --noEmit` クリーン（旧コードで warning だった react-hooks/set-state-in-effect も解消）

## 2026-06-09 – fix(data): staging テナントの課金モードを無制限に変更（Notion データ修正）
- fix: staging テナント（tenant_id: mewodas-staging）の「課金モード」を `Stripe連動` → `無制限` に変更（Notion 直接更新）
- 原因: 課金モードが `Stripe連動` のまま契約席数=1 に対して進行中顧客（テスト太郎）が1席を消費し `isOverLimit=true` になっていた。社長の LINE アカウントが staging 顧客として未登録のため `alreadyRegistered=false` → over-limit 画面が表示されていた
- 影響範囲: staging テナントの席数判定。コード変更なし。本番テナント（mewodas / 五反田店）は無変更
- 変更前: 課金モード=Stripe連動、契約席数=1、支払いステータス=お試し（Stripe連携なし）
- 変更後: 課金モード=無制限（契約席数・支払いステータスは変更なし）
- 関連: docs/BILLING_CONTROL_DESIGN.md「社長のテストテナントは無制限で運用」方針に準拠

## 2026-06-09 – fix(LIFF): 体重保存の2バグ修正（上書き保存が古い値に戻る・保存時スクロール）（branch: staging）
- fix(バグ①): `app/home/_components/LiffGate.tsx` `handleWeightUpdated` で `/api/extras` の結果が楽観的更新済みの体重値を上書きする競合を修正。保存 POST 完了前に extras を取得すると保存前の値が返り UI が古い値に戻ることがあった。楽観的更新 (`next.weight`) がある場合は extras.weight で体重を上書きしないよう変更
- fix(バグ②): `components/WeightExerciseCard.tsx` `WeightSheet.save()` と `ExerciseSheet.save()` の先頭で `document.activeElement?.blur()` を呼び、保存前にソフトキーボードを閉じるよう変更。iOS Safari(LIFF WebView) でキーボードのdismissとシートのアンマウントが重なるとページが一番下にスクロールする既知の問題を回避
- fix(防御): WeightSheet・ExerciseSheet の保存ボタンに `type="button"` を追加（フォームコンテキスト不問でデフォルト submit 動作を防止）
- 影響範囲: 顧客側 LIFF（/home 体重・運動保存UI）。API・DB 変更なし

## 2026-06-09 – feat(reports): 週次レポートの体重ブロックを「週平均ベース」新フォーマットに対応
- feat: 週次/月次レポートで「週平均体重・前週平均・その差・目標までの残り」を出せるよう新変数を追加
  - `lib/notion.ts`: `getWeightAvgInRange()` 追加（期間内に記録された体重の平均と件数を返す）
  - `lib/reports/dateRange.ts`: `previousPeriod()` 追加（直前の同期間＝前週/前月相当を算出。「前週平均」用）
  - `lib/reports/variables.ts`: 引数に `weightAvg` / `prevWeightAvg` を追加。新変数 `{weightAvg}` `{prevWeightAvg}` `{weekAvgDelta}` `{weightRemaining}` を出力。`{requiredPace}` と `{weightRemaining}` は週平均を基準に算出（週平均が無い期間は従来どおり登録体重 currentWeight にフォールバック）
  - `app/api/admin/reports/generate/route.ts` / `app/api/cron/daily-reports/route.ts`: 週平均・前週平均を取得して `buildReportVariables` に受け渡し
- test: `__tests__/lib/report-variables.test.ts` に新変数の回帰テストを追加（全6件パス、`tsc --noEmit` パス）
- 後方互換: 新引数は任意。未指定時は `weightAvg` が最終体重にフォールバックし、`prevWeightAvg`/`weekAvgDelta` は `-`。既存テンプレ（{startWeight}→{endWeight} 等）はそのまま動作
- 注意（順序依存）: Notion 側の週次レポートテンプレ本文を新変数（{weightAvg} 等）に差し替えるのは**本コードを本番デプロイした後**に行うこと。先にテンプレだけ変えると旧コードが未知変数を素通しし、顧客の週次配信に `{weightAvg}` がそのまま表示される
- 影響範囲: lib / API / cron（バックエンド）。Notion テンプレ本文は別途・デプロイ後に切替

## 2026-06-07 – fix(LIFF): meal-detail「+メニューを追加」で過去日付が引き継がれないバグ修正（branch: staging）
- fix: `app/meal-detail/page.tsx` 321行目。「+メニューを追加」ボタンが `/record?meal=...&day=${今日か昨日}` で遷移していたため、今日でも昨日でもない日付（例: 06/05）を開いている場合に強制的に `day=昨日` が渡されていた
- 修正内容: `day=` パラメータを廃止し、`date=${date}` で正確な YYYY-MM-DD を渡すよう変更。`/record` 側は既に `date` クエリパラメータを受け取る実装済みのため受け側変更不要
- あわせて食事区分（`meal=` パラメータ）も従来どおり引き継がれる
- 影響範囲: 顧客側 LIFF（/meal-detail → /record 遷移）。API・DB 変更なし

## 2026-06-03 – fix(security): frame-src に `https://*.line-apps.com` を追補
- fix: `next.config.ts` の `frame-src` に `https://*.line-apps.com` を追加（#41 の追補）。調査で frame-src 違反元として高確度で想定されていた LIFF ログインサブウィンドウ iframe ドメインをカバー
- 背景: #41 は frame-src に `*.line-scdn.net` を追加したが、実ブロックURI（Sentry `csp_blocked_host`）未確認のため line-apps.com 経由の違反が残る懸念があった。両ドメインをカバーして確実化
- 影響範囲: CSP ヘッダーのみ・Report-Only のため顧客への動作変化なし。line-apps.com は既に connect-src で許可済みの LINE 公式ドメイン

## 2026-06-03 10:00 a0621ed
- fix(security): CSP に `script-src-elem` ディレクティブ追加 + `frame-src` に `https://*.line-scdn.net` 追加
- 影響範囲: API / インフラ（CSP ヘッダー変更）。顧客側は Report-Only のため現時点で動作変化なし
- 関連: Slack #security-alerts アラート ts=1780391970.925839（script-src-elem・frame-src 違反報告）
## 2026-06-03 – fix(security): CSP connect-src に https://*.line-scdn.net を追加（branch: claude/sec-fix-0670559）
- fix: `next.config.ts:25` の `connect-src` に `https://*.line-scdn.net` を追記（1行追加）
- 影響範囲: セキュリティヘッダーのみ。現在 Report-Only のため顧客への即時影響なし。enforce 昇格時に LIFF SDK 通信が遮断されないよう修正
- 関連: Slack #security-alerts alert_ts 1780391960.670559（CSP violation report: liffsdk.line-scdn.net が connect-src 違反）

## 2026-06-02 – test(security): クロステナント/クロス顧客 IDOR の回帰テスト追加 ＋ 既存署名改ざんテストのフレーキー修正（branch: security/ownership-repo-layer・未マージ）
- test: `__tests__/lib/cross-tenant-ownership.test.ts`（新規・17ケース）。2026-05-31 監査 設計#10。所有権チェックがリポジトリ/データ層に集約済（設計#2＝既に origin/main 実装済）であることを固定する回帰テスト。`@/lib/tenant` の `getCurrentTenant` と `global.fetch` をモックし、(1) `assertCustomerOwnership`/`getCustomerByPageId`＝他テナント顧客DBの pageId を拒否/null、(2) `assertFoodRecordOwnership`＝他テナント食事DB拒否＋同一テナント内の別顧客(LINE_UserID不一致)を拒否、(3) `repository/customers`・`repository/records`＝patch/archive が他テナント pageId で forbidden 後、更新処理に到達しない（fetch 1回のみ）、(4) `lib/stores` の getStore/updateStore/deleteStore＝他テナント tenant_id を null/forbidden、を検証
- fix(test): `__tests__/lib/auth-token-separation.test.ts` の「署名改ざんトークンは拒否」を、トークン末尾1文字反転→**署名先頭文字反転**に変更。末尾は base64url パディングで下位bitが捨てられ A↔B 反転してもデコード後バイト列が変わらず改ざん検知をすり抜ける場合があり、`exp=Date.now()+60s` の署名差で実行タイミング次第に false-fail するフレーキーだった。先頭文字は全6bit有効で確実に変わる。全37ケースを3回連続グリーンで安定確認
- 影響範囲: テストのみ（dev tooling）。ランタイム・顧客側・API・DB 変更なし。`tsc --noEmit` クリーン、`next build` 成功
- 注: 設計#2（所有権チェックのリポジトリ層集約）は監査メモ(2日前)時点で未了だったが、その後の P0/P1 修正で customers/records/stores すべて実装済みを実コードで確認。本コミットは「実装の固定（回帰防止）」が主目的
- 関連: [[project_security_audit_2026_05_31]] 設計#2/#10。**本番反映は社長承認後**（rule4 で dev tooling は main 直可だが、まとめて確認いただくため feature ブランチに保留）

## 2026-06-02 – fix(analysis): 顧客分析の食事一覧 ↔ AIサマリを排他表示（後押し優先で切替）（branch: main・admin直push）
- fix: `app/admin/analysis/page.tsx`（/store/analysis は同ファイルを re-export）。食事一覧（`mealList`）と AIサマリ（`analysis`）が独立 state で同時描画され、AIサマリ section が長い食事一覧の**下**に出るため「食事一覧を見る→AIでサマリ作成」でサマリが画面外下に生成され「反応しない／表示されない」ように見えていた。`runAi()` 冒頭で `setMealList(null)`/`setMealListError(null)`、`fetchMealList()` 冒頭で `setAnalysis(null)`/`setAiError(null)`/`setAiMessage(null)` を追加し、**後から押した方に切り替わる排他表示**に変更
- 影響範囲: 管理画面（/admin・/store 顧客分析）の表示のみ。顧客側 LIFF・API・DB 変更なし。tsc 当該ファイル通過
- 関連: 社長報告「食事一覧を見る後にAIでサマリ作成を押すとAIサマリが反応/表示されない」
## 2026-06-05 – fix(LIFF): 運動「した」トグルの「顧客が見つかりません」誤エラーも解消（GASベストエフォート化）（branch: staging）
- fix(exercise): `app/api/log/exercise/route.ts`。ホームの「運動した」簡易トグルの GAS 書き込み（`liff_save_exercise`）を **try/catch でベストエフォート化**。これまでは GAS が `顧客が見つかりません` を返すと 500 になり、顧客に「運動保存に失敗しました: 顧客が見つかりません」とアラート表示していた（体重保存と同じ罠）
- 安全性の根拠: ①ホームは運動状態を読み戻さない（`/api/today` は `exercised:''` 固定）②GAS シート由来の運動は `foodSheetPageId` を持つ mewodas 系顧客の admin 分析でのみ参照（運動DB `/api/exercise-log` を優先し日付でdedup）。よって mewodas 顧客は従来どおり GAS 成功で挙動不変、自己登録・他テナント顧客は GAS 失敗を静かにスキップ（元々読まれないデータ）＝**偽エラーが消えるだけで実害なし**
- 補足: 簡易トグル（boolean+自由文）は構造化運動DB（`/api/exercise-log`：category/duration/intensity）とデータモデルが別物のため、DB ミラーは admin 分析の二重計上を招くので**あえて行わない**。GAS ベストエフォートが最小・最安全の正解
- 影響範囲: 顧客側 API（`/api/log/exercise`）のみ。DBスキーマ変更なし。tsc 通過
- 関連: 直前の体重/AI相談バグ修正で「既知の関連リスク」として挙げた運動トグルへの対応（社長「続けて修正して」・2026-06-05）。[[feedback_gas_single_tenant_besteffort]]

## 2026-06-05 – fix(LIFF): 体重保存の「顧客が見つかりません」誤エラー解消 / AI相談 Gemini 503 を自動リトライ＋平易な文言に（branch: staging）
- fix(weight): `app/api/log/weight/route.ts`。体重保存の主従が逆転していた問題を修正。**Notion 体重ログDB（`createWeightLog`／ホーム表示=`/api/today` の `getLatestWeight` が参照する真実のソース）を必須の書き込み**にし、**GAS（旧 mewodas スプレッドシート連携・全テナント共通の単一エンドポイント）はベストエフォートのミラー**に降格。これまでは GAS が主で、自己登録顧客・mewodas 以外のテナント顧客が GAS シートに居ないと `{ ok:false, error:'顧客が見つかりません' }` を返し、**DB には正しく保存できているのに**顧客へ「体重保存に失敗しました: 顧客が見つかりません」と誤表示していた。`/api/exercise-log` の「顧客未検出でも保存する」設計に整合
- fix(chat): `lib/gemini.ts` `chatWithAi`。単発 fetch（リトライ無し・フォールバック無し）を、PFC解析の `callGemini` と同方式の **主モデル(gemini-2.5-flash)→フォールバック(gemini-2.5-flash-lite)＋各 `MAX_RETRIES` 指数バックオフ** に変更。Gemini 過負荷（503/UNAVAILABLE/high demand）で救済できなかった場合も、生のエラーJSON（`Gemini Chat失敗 503: {...}`）ではなく **「AIが混み合っています。少し時間をおいてからもう一度お試しください。」** を返す。安全フィルタ/空応答は従来どおり非リトライで即返す
- 影響範囲: 顧客側 API（`/api/log/weight`・`/api/chat`）／`lib/gemini.ts`。**DBスキーマ変更なし**。tsc 通過
- 既知の関連リスク（今回は未修正）: ホームの「運動した」簡易トグル `app/api/log/exercise/route.ts` も GAS のみ書き込みで同じ「顧客が見つかりません」が起き得る（データモデルが boolean+free text で DB 版 `/api/exercise-log` と別物のため要別途検討）
- 関連: 顧客からのバグ報告スクショ3枚（2026/06/01 体重保存エラー＋AI相談 503×2）。[[project_fitmeal_saas]] [[feedback_test_customer_line_id]]

## 2026-06-05 – perf(cron): daily-reports のテナント一覧取得を1回に集約（branch: staging）
- perf: `app/api/cron/daily-reports/route.ts`。`listTenantRows` をリスク配信/トライアルリマインド/オンボ催促/レポート配信で個別に呼んでいた（3〜4回）のを**冒頭で1回取得して共有**。`runTrialReminders`/`runOnboardingNudges`（`lib/trialReminders.ts`/`lib/onboardingNudge.ts`）に `prefetchedRows` 引数を追加（未指定なら従来どおり自前取得＝後方互換）
- 影響範囲: 日次cronのみ。**挙動不変**（Notionクエリ回数の削減のみ）。tsc通過・`next build`成功
- 関連: 導線改善（Rank1〜5）後のクリーンアップ（社長「全部進めよう」・2026-06-05）

## 2026-06-04 – feat(funnel): Rank3 オンボ未完了の催促 / Rank4 ウェルカムメール失敗通知 / Rank5 席アップグレードCTA（branch: staging）
- feat(Rank3): `lib/onboardingNudge.ts` 新規 `runOnboardingNudges`。契約開始(`startDate`)から **1/3/7日** たっても未連携(`onboardingCompletedAt=null`)の店舗オーナーへセットアップ催促メール（/store/start へ誘導）。`daily-reports` cron に相乗り（残日数判定＝状態保存不要・7日で打ち切り）。`lib/email.ts` に `onboardingNudgeEmail` 追加
- feat(Rank4): `lib/provisionTenant.ts`。ウェルカム/ログイン情報メール送信に失敗した場合、運営へ **Slack 通知**（`notifySlack`）。オーナーが初期PWを受け取れていないので /admin/tenants から再発行→手動連絡する導線を案内
- feat(Rank5): `app/admin/billing/page.tsx`。上限到達/残り1席バナーに「**今すぐ増枠する**」CTAボタンを追加（席変更モーダルを直接起動。Stripe連動モードのみ表示・手動/無制限は運営管理のため非表示）
- refactor: 日付の日数計算を `lib/dateDays.ts`（`todayYmdJst`/`daysBetweenYmd`）に集約し、`lib/trialReminders.ts` も共用（DRY）
- 影響範囲: API(`cron/daily-reports`)・`lib`・`app/admin/billing` のみ。**顧客側LIFF・DBスキーマ変更なし**。tsc通過・`next build`成功
- 前提env: メール=`RESEND_API_KEY`（未設定なら no_provider でスキップ）、Slack=`SLACK_WEBHOOK_URL`（任意）
- 関連: 導線監査 Rank3/4/5 フル対応（社長「Rank5まで進めて」・2026-06-04）。staging検証 → 社長確認後に main

## 2026-06-04 – feat(reports): 週次/月次に「目標達成日・必要/今週ペース＋週間平均(目標比)の絵文字評価」変数を追加（branch: staging）
- feat: `lib/reports/variables.ts` にレポート変数を追加。`targetDate`（目標達成日）、`weeksToGoal`（残り週数）、`requiredPace`（必要ペースkg/週＝|登録体重−目標|÷残り週数。GoalProgressCard と同ロジック）、`weekPace`（期間の実ペースを週あたり正規化・符号付き）、`weekPaceMark`（⭕目標方向に必要ペース以上/🔺方向は合うが不足/💦逆方向）、PFC目標比の評価絵文字 `kcalMark`/`PMark`/`FMark`/`CMark`（⭕90〜110% / 🔺80〜90%・110〜120% / 💦それ未満・超過＝上下対称）。すべてコードで確定計算（AI非依存）
- 影響範囲: レポート変数のみ（テンプレが参照すれば表示）。顧客側 LIFF 変更なし。tsc 通過。実例の数値（カロリー79.6%💦/タンパク質82.6%🔺/脂質93.3%⭕/炭水化物70.5%💦）と一致を runtime 検証済
- 残（**本番マージ後**・テンプレDB共有のため）: 週次・月次4種テンプレに「目標までのペース」「週間平均（目標比）」ブロックを追記
- 関連: 社長フィードバック（目標達成日/必要ペース/今週ペース＋目標比の絵文字をレポートに入れたい）。[[project_report_revamp_2026_06_04]]

## 2026-06-04 – change(store): 通知設定の文言整理＋リスク配信タイトルを「フォロー対象」に（branch: staging）
- change: `app/store/notifications/page.tsx`。①説明文の 🔔 絵文字を Bell アイコンに ②各トグルの説明文（「〜している顧客」）を削除しラベルのみに ③ラベルの「途絶え」→「漏れ」（食事記録の漏れ／体重記録の漏れ／体重目標の停滞）
- change: `app/api/cron/daily-reports/route.ts`。日次リスク配信のお知らせタイトルを `【本日の要注意顧客 N名】` → **`【フォロー対象 N名】`**（「要注意顧客」表現を回避＋短縮で1行に）。重複判定の prefix も同期
- 影響範囲: 管理画面（/store 通知設定）＋日次配信cronのタイトルのみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（絵文字→アイコン／説明文不要／途絶え→漏れ／タイトル短縮／要注意顧客の言い換え）

## 2026-06-04 – feat(reports): 週次/月次レポートの体重を「開始→最終(増減)」表記化＋達成率%廃止＋顧客分析の送付導線常設（branch: staging）
- feat: レポート変数に `startWeight`/`endWeight`/`weightDelta` を追加。`lib/notion.ts` に `getWeightBoundsInRange`（期間内の最初/最後の有効体重を1回の取得で返す。`getLastWeightInRange` は薄いラッパに）。`lib/reports/variables.ts` に `firstWeight` 引数を追加し、`{startWeight}kg → {endWeight}kg（{weightDelta}kg）` を組める変数を公開（増減は `+1.2`/`-1.7`/`±0` 形式）。呼び出し側 `app/api/admin/reports/generate/route.ts`・`app/api/cron/daily-reports/route.ts` を bounds 取得に変更し firstWeight を伝播
- change: AIコメント生成（`lib/gemini.ts` `generateReportComments`）から「達成率○%」を除去。プロンプトに「割合(%)表現は使わず、目標との差は kcal・g の実数で。食事管理は100%必達ではなく減量幅で適正量が変わる前提」ルールを追加
- change(admin/store): 顧客分析（`app/admin/analysis/page.tsx`＝`/store/analysis`再エクスポート）の「顧客送信用ドラフト」セクション（お客さん向けメッセージ）を**削除**し、代わりに `customerId` がある間は常設の「○○さんにレポートを送付」ボタン（→`/reports?customerId=...`）を表示。未使用化した `FileText` import を除去。AI 分析の `reportDraft` フィールド自体はバックエンド（テンプレなしAI本文）で継続利用のため残置
- 影響範囲: レポート本文（顧客がLINEで受信）＋管理画面（顧客分析/送付）＋日次配信cron。顧客側 LIFF 画面の変更なし。`next build` 通過
- 残作業（**本番マージ後に実施**／テンプレDBは staging と本番で共有のため新変数は先にコード本番反映が必須）: Notion「FitMeal テンプレート」6種の (1)並び替え＝前日あり/週次あり/月次あり→前日なし/週次なし/月次なし、(2)週次・月次の体重行を `開始 {startWeight}kg → 最終 {endWeight}kg（{weightDelta}kg）` に、(3)前日レポートの `（{kcalRatio}%）` を削除し実数のみに
- 関連: 社長フィードバック（体重は開始→最終で見せる／%表記は分かりづらい／お客さん向けドラフトは不要／分析から送付導線が欲しい）

## 2026-06-04 – feat(admin/store): 顧客リスクお知らせを3種類(食事記録/体重記録/体重目標)に細分化し個別ON/OFF（branch: staging）
- feat: 通知設定の「顧客リスクお知らせ」を1トグル→**3トグル**に。食事記録の途絶え/体重記録の途絶え/体重目標の停滞 を個別にON/OFF。`app/store/notifications/page.tsx`（3トグルUI、楽観更新＋PATCH、説明は上部amber・店舗=緑）
- feat: バックエンド出し分け。`app/api/cron/daily-reports/route.ts` の `isAtRisk`/`riskLabel` をフラグ引数化し、ONの種類だけ判定・ラベル化。テナントゲートも3フラグの全OFF判定に。`lib/notion.ts`（TenantRow型・read・patch に `リスク食事記録`/`リスク体重記録`/`リスク体重目標` チェックボックス列を追加）、`lib/tenant.ts`・`lib/tenantResolver.ts` に伝播。`app/api/admin/tenant-settings/route.ts` GET/PATCH に3フラグ追加（PATCH時に master `リスクアラート`=anyOn を同期）
- migration: Notion「FitMeal テナント」DB に3チェックボックス列を追加し、既存3テナント（メヲダス/Staging=ON→3列ON、テスト=OFF→3列OFF）をデータ移行済み（既存挙動保持）
- 影響範囲: 管理画面（/store 通知設定）＋日次配信cron＋テナント設定API。顧客側 LIFF 変更なし。tsc 通過。速度影響なし（計算は不変・出し分けフィルタのみ）
- 関連: 社長フィードバック（食事記録/体重記録/体重目標で個別ON/OFF）

## 2026-06-04 – change(store): 通知設定の説明文を上部へ移動＋確認先を「右上のベルマーク」に（branch: staging）
- change: `app/store/notifications/page.tsx`。「お知らせは毎日の定期配信と同時に送られます／受信は…で確認できます」の説明（amber）を「顧客リスクお知らせを受け取る」カードの上へ移動。確認先の文言を「『お知らせ』画面の受信トレイ」→「画面右上のベルマーク 🔔 から確認できます」に変更（お知らせ画面はナビ未設置のため）
- 影響範囲: 管理画面（/store 通知設定）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック。※リスクお知らせの細分化(食事記録/体重記録/体重目標で個別ON/OFF)は要確認の別タスク

## 2026-06-04 – fix(admin/store): サイドバーのグループが遷移で畳まれる問題を修正（sticky open）（branch: staging）
- fix: `app/admin/AdminShell.tsx`。openGroups を tri-state(null/true/false の `?? active` 既定)から**独立した真偽値**に変更し、現在地のグループを useEffect で**加算的に開く**方式に。これまでは現在地で自動展開していたグループ（明示トグルなし）が、別グループのページへ遷移して active 解除されると畳まれていた（例: /store/progress で開いていた進捗管理が、契約管理クリックで畳まれる）。修正後は一度開いたグループは矢印で明示的に閉じるまで開いたまま＝複数同時に開いたまま遷移できる（スクエア方式）
- 影響範囲: 管理画面（/admin・/store）のサイドバー挙動のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（契約管理クリックで進捗/レポートのアコーディオンが閉じる）

## 2026-06-04 – change(admin/store): サイドバーのグループを複数同時に開けるよう独立トグル化（branch: staging）
- change: `app/admin/AdminShell.tsx`。グループ展開をアコーディオン（1つ開くと他を閉じる）から**独立トグル**に変更（`setOpenGroups(() => ({X:..., 他:null}))` → `setOpenGroups((g) => ({...g, X:...}))`）。複数グループを同時に開いたままにでき、別ページへ遷移しても開いているグループは畳まれない（スクエアと同じ）。`?? Xactive` 既定により未操作グループは現在地に応じて自動開閉
- 影響範囲: 管理画面（/admin・/store）のサイドバー挙動のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（複数開いた子ページが無関係な遷移で畳まれる→開いたまま・スクエア方式）

## 2026-06-04 – change(admin/store): サイドバーをスクエア方式に（アクティブな現在地のみ色＋〇／親は無色）（branch: staging）
- change: `app/admin/AdminShell.tsx`。ハイライトを Square 風に変更: **現在地（アクティブな子/トップ項目）だけ**にアクセント色＋右端の〇を付け、**親（進捗管理/レポート管理/設定の各グループ見出し）には色を付けない**（展開状態でも無色、シェブロン回転のみ）。トップ項目の色抑制(`anyGroupOpen`)を撤去し、現在地は常に色が付くように。親の左アクセントバーも撤去
- 影響範囲: 管理画面（/admin・/store）のサイドバー表示のみ。挙動・ロール出し分けは不変。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクエアと同じ・クリックしてるページだけ色と〇・親には色なし）

## 2026-06-03 – change(store): 「LINE 連携セットアップ未完了」バナーを店舗カラー(緑)に（branch: staging）
- change: `app/admin/customers/page.tsx`。店舗(/store)限定で出る「LINE 連携のセットアップが未完了です」バナー＋「セットアップを始める」ボタンを violet→emerald(緑)に。店舗=緑のテーマに統一（isStore 限定表示のため緑固定）
- 影響範囲: 管理画面（/store 顧客管理）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（LINEのセットアップを store は緑に）
## 2026-06-04 – feat(billing): past_due 通知＋トライアル終了前リマインドメール（Rank2 残り完了）（branch: feat/store-activation-guide）
- feat(email): `lib/email.ts` に `trialEndingEmail`（終了4日前/前日）と `paymentFailedEmail`（カード更新案内）を追加
- feat(slack): `lib/slack.ts` 新規 `notifySlack`。`SLACK_WEBHOOK_URL` があれば Incoming Webhook に POST、未設定なら no-op（呼び出し元を壊さない）
- feat(reminders): `lib/trialReminders.ts` 新規 `runTrialReminders`。お試し中×Stripe連動のテナントへ、初回請求(`nextBillingDate`)まで残4日/前日にオーナーメール。**日次cron `daily-reports` に相乗り**（レポート設定と独立して毎日実行・残日数で判定＝状態保存不要・重複なし）
- feat(webhook): `app/api/stripe/webhook` の `invoice.payment_failed` で `paymentStatus=未払い` に加え、**オーナーへカード更新メール＋運営へSlack通知**（try/catchで失敗してもStripeへは200）
- 影響範囲: API(`cron/daily-reports`・`stripe/webhook`)・`lib` のみ。**顧客側LIFF・DBスキーマ変更なし**。tsc通過・`next build`成功
- 前提env: メール=`RESEND_API_KEY`（未設定なら no_provider で送信スキップ）、Slack=`SLACK_WEBHOOK_URL`（任意）
- 関連: 導線監査 Rank2「サイレント・トライアル転換」フル対応（社長「AB」指示・2026-06-04）

## 2026-06-04 – feat(store/admin): トライアル残日数表示＋店舗オンボのadminリセット＋初回ログイン誘導（branch: feat/store-activation-guide）
- feat(billing): `app/admin/billing/page.tsx`（=/store/billing 共有）。`paymentStatus==='お試し'` のバナーを **残日数カウントダウン＋初回請求日（＋月額）** に拡張。終了3日前で警告色（amber）。`nextBillingDate` から算出＝新フィールド不要。導線監査 Rank2「サイレント・トライアル転換」の可視化対応
- feat(admin): `app/api/admin/tenants/[id]/onboarding/route.ts` 新規（DELETE・**withMasterOnly**）。運営がテナントの店舗オンボをリセット（`onboardingStep:0`/`onboardingCompletedAt:null` のみ・LIFF/トークン/リッチメニュー等の実設定は保持）。顧客側ツアーリセット(`customers/[id]/onboarding`)と同思想
- feat(admin-ui): `app/admin/tenants/[id]/page.tsx` に「店舗オンボーディング」リセットセクション追加（PasswordSection 直下・状態表示＋確認ダイアログ）。ローカル Tenant 型に `onboardingCompletedAt` 追加
- change(store): `app/store/page.tsx` ルートリダイレクトを賢く。tenant_admin かつオンボ未完了 → `/store/start`（初回ログインでスタートガイドが出る）、完了後は `/store/customers`。master は素通り。Notion取得失敗時は顧客管理にフォールバック
- 影響範囲: 店舗側(/store)・運営(/admin)・API のみ。**顧客側 LIFF・DB スキーマ変更なし**。tsc 通過・`next build` 成功
- Rank2 残（未実装・要infra判断）: トライアル10日目/前日のリマインドメール（既存 daily cron へ）・past_due の Slack/オーナーメール通知。0社のため即効性低く後続
- 関連: 社長指示「Rank2まで進めて／顧客オンボと同じ感じでadminからstoreオンボをリセット／初回ログインのみ表示か？」（2026-06-04）

## 2026-06-04 – feat(store): スタートガイド（アクティベーション導線）＋お客様招待リンク/QR を新設（branch: staging/store-activation-guide）
- feat(store): `app/store/start/page.tsx` 新規。店舗の初回立ち上げを貫く **アクティベーション・ハブ**。①LINE連携 →②お客様を招待して登録 →③初記録 のチェックリスト（進捗バー付き）＋ **お客様招待セクション**（友だち追加リンクのコピー＋店頭ポスター用QRコード＋共有のしかた案内）。既存の招待トークン基盤(`lib/inviteToken.ts`)はあったが店舗UIが無く、連携後に「お客様をどう入れるか」の導線が欠落していた穴を埋める
- feat(api): `app/api/store/activation/route.ts` 新規。連携状態(onboardingCompletedAt/liffId+token)・友だち追加URL(officialLineUrl)・顧客数(listCustomers)・初記録有無 を集約して返す（60秒キャッシュ・withAdminTenant 保護）
- feat(api): `app/api/store/invite/qr/route.ts` 新規。友だち追加URLの **QRコードを SVG でサーバー生成**（外部サービス非依存・印刷可）。`qrcode` 依存を追加
- feat(lib): `lib/notion.ts` に `hasAnyFoodRecordSince(date)` 追加（page_size:1 の安価な存在判定。全件スキャンを避ける）
- change(nav): `app/admin/AdminShell.tsx`。店舗サイドバー先頭に「スタートガイド」(ListChecks・storeOnly) を追加（master/admin には非表示）
- change(store): `app/store/onboarding/page.tsx` 完了画面に「次は、お客様を招待しましょう」CTA（→ /store/start）を追加
- 影響範囲: 店舗側(/store)・API のみ。**顧客側 LIFF・DB スキーマ変更なし**。tsc 通過・`next build` 成功（/store/start 含む全ルートコンパイルOK）
- 検証残: staging push → fitmeal-qa → 社長の店舗UI確認。push は origin/staging が並行作業で先行(b97c047)のため統合(fetch+rebase)後に実施
- 関連: 社長指示「店舗側オンボーディング機能の実装＋申込→招待→有償化導線の改善」（2026-06-04 夜間自走）

## 2026-06-03 – fix(admin/store): サイドバーのグループを矢印で確実に畳めるよう修正＋トップバーのベル/バッジを少し縮小（branch: staging）
- fix(sidebar): `app/admin/AdminShell.tsx`。グループ展開状態を `manual || active` から **tri-state（null=現在地に従う / true・false=明示トグル）** に変更。`openGroups` を `boolean|null`、`progressOpen/reportsOpen/settingsOpen` を `?? active` に、各トグルは他グループを `null`（=現在地に従う）にリセット。これにより**レポート管理等のグループ内ページにいても上矢印で確実に畳める**（従来は active が常に開状態を強制し畳めなかった）
- change(topbar): ベル（`w-11→w-10`/アイコン`w-6→w-5`/バッジ`w-4→w-3.5`・位置を-top/-right-0.5に）と店舗/アドミンバッジ（`px-3.5→px-3`/`py-1.5→py-1`/アイコン`w-5→w-4`/gap詰め）を一回り縮小（前回拡大しすぎたぶんの調整）
- 影響範囲: 管理画面（/admin・/store）サイドバー＋トップバー表示のみ。顧客側 LIFF・DB 変更なし。tsc 通過
- 関連: 社長指示「レポート管理を開いた後 上矢印で畳めない／ベル・店舗バッジをもう少し小さく」

## 2026-06-03 – change(admin/store): 食事バランスの文字を顧客分析の他項目に合わせ text-[11px] に統一＋凡例の隙間を詰める（branch: staging）
- change: `app/admin/analysis/page.tsx`。食事バランスのフォントを少し小さくし顧客分析の他セクションと同じ `text-[11px]` に統一（見出し・凡例・小見出し）。中央kcalは text-base、ドーナツは 128→112px に微縮小。凡例は `flex-1` の間延びをやめ固定幅に詰め、P/F/C と g・% の隙間を縮小（`tabular-nums` で桁揃え維持）
- 影響範囲: 管理画面（/admin・/store の顧客分析）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（少し小さく・他項目と同フォント・PFCとgの隙間を詰める）

## 2026-06-03 – change(admin/store): サイドバー再編（レポート管理グループ化・進捗一覧へ改称・設定並び替え）＋store設定ページの緑化＋トップバー拡大（branch: staging）
- fix(store色): `app/store/onboarding/page.tsx`（LINE連携設定）＋`app/store/notifications/page.tsx`（通知設定）の violet(紫)を emerald(緑)へ一括置換。store専用ページなので role配色（店舗=緑）に統一（紫の取りこぼし解消）
- change(menu): `app/admin/AdminShell.tsx`。① 進捗グループ配下の子「進捗管理」→**「進捗一覧」**に改称（親グループ見出しは「進捗管理」のまま）。② 「レポート送付」を**「レポート管理」グループ**（開閉ドロップダウン）に変更し、配下に**「レポート作成」**（旧レポート送付 /reports）＋**「テンプレ管理」**（/templates を設定から移動）を表示。③ 設定グループの並びを **契約管理→通知設定→店舗一覧→LINE連携設定**（store）に変更（テンプレ管理は設定から除外＝レポート管理へ）。`reports` グループ用 state/トグル（3グループ排他）と描画を追加
- change(topbar): トップバーのベル（`w-9→w-11`/アイコン`w-4→w-6`）と店舗/アドミンバッジ（`text-xs→text-sm`/アイコン`w-4→w-5`/余白拡大）を一回り大きく
- 影響範囲: 管理画面（/admin・/store）のサイドバー＋store設定2ページ＋トップバー表示のみ。顧客側 LIFF・DB 変更なし。tsc 通過。※menu再編は/admin・/store共通（admin もレポート管理グループに テンプレ管理 が入る）
- 関連: 社長指示（スクショ1件）。並行セッションが同ファイル群を編集中のため最新 origin/staging 上に適用
## 2026-06-03 – change(admin/store): 顧客分析「食事バランス」をリデザイン（文字拡大・グレー枠撤去）（branch: staging）
- change: `app/admin/analysis/page.tsx`。食事バランスの5ドーナツを見やすく刷新: ①各セルのグレー枠(bg-stone-50 border)を撤去しフラットに ②ドーナツ拡大(88→128px) ③中央kcalを text-xl、凡例を text-sm、見出しを text-sm に拡大 ④数値は tabular-nums で桁揃え ⑤カロリー配分セルに lg で右ボーダーを付け各食事PFC群と視覚的に区切り ⑥余白(行間)を拡大
- 影響範囲: 管理画面（/admin・/store の顧客分析）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（文字を大きく・グレー枠不要・見やすくリデザイン）

## 2026-06-03 – change(admin/store): 顧客分析「食事バランス」をドーナツ5枚横並びに刷新（カロリー1＋各食事PFC4）（branch: staging）
- change: `app/admin/analysis/page.tsx`。食事バランスを「カロリードーナツ＋PFCテキストリスト（左右に間延び）」から、**カロリー配分ドーナツ1つ＋朝/昼/夕/間それぞれのPFCドーナツ4つを横並びグリッド**（`lg:grid-cols-5`、タブレット3列/モバイル2列）に刷新。各セルに中央kcal表示の小ドーナツ＋凡例（カロリーは食事別kcal/%、PFCはP/F/Cのg/%）。余白を詰めて一目で比較可能に
- 旧 `MealTypePie`/`MealPfcList` を撤去し `MiniDonut`/`MealBalanceCharts` に置換。値は従来どおり1日あたり平均（レポートと統一）。recharts 使用
- 影響範囲: 管理画面（/admin・/store の顧客分析）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ・食事バランス枠にカロリー1＋PFC4を並べる）

## 2026-06-03 – change(admin/store): レポート送付の「送信元店舗」表示セクションを削除（branch: staging）
- change: `app/admin/reports/page.tsx`。顧客選択後に出ていた紫の「送信元店舗（顧客の所属から自動）」表示ボックスを削除（社長指示・不要）。署名の自動付与ロジック（customerStore）は維持。店舗未設定時の amber 警告（署名が付かない旨）は残置
- 影響範囲: 管理画面（/admin・/store のレポート送付）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過

## 2026-06-03 – fix(analysis): 顧客分析の食事区分別をレポートと統一（1日あたり）＋食事区分別PFC（g+食事内%）表示（branch: staging）
- fix: `lib/analysisAggregate.ts` ＋ `app/admin/analysis/page.tsx`（`MealTypePie`）。顧客分析「食事区分別カロリー」が **その食事を記録した日数で割る（kcal/回）** ためレポート（÷全記録日数=1日あたり）と数値がズレていた（特に間食が過大・合計が上部平均と不一致）。**÷全記録日数(totalDays)に統一**し、朝+昼+夕+間 が上部「平均カロリー」と一致するように
- add: `lib/analysisAggregate.ts` に食事区分別 PFC 合計（`mealTypeP/F/C`）を追加し API (`/api/admin/customers/[id]/analysis/data`) で返却。「PFC バランス」を **食事区分別 PFC（1日あたり・g＋その食事内のPFC比率%）** 表示に変更（`PfcPie`→`MealPfcList`）。社長指定レイアウト（朝昼夕間ごとに P/F/C の g と %）
- chore: 画面で未使用化した `mealTypeCount` の state を除去（API は参考値として引き続き返却）
- 影響範囲: 管理画面（/admin・/store 顧客分析）の表示のみ。顧客側 LIFF・DB 変更なし。tsc 通過。集計は tsx で実関数検証（食事合計＝1日平均で一致を確認）
- 関連: 社長指摘「顧客分析とレポートで朝昼夕間の数字がズレる→統一／分析のPFCも朝昼夕間ごとにg＋%で（レポートと同じイメージ）」。※同ファイル(analysis/page.tsx)を並行編集した role配色コミット(f67c252)の上に rebase 済み

## 2026-06-03 – change(admin/store): 色テーマ第2弾 主要アクションボタンを role 配色に（店舗=緑 / 運営=紫）（branch: staging）
- change: 保存／追加／送信などの主要アクションボタン（塗りつぶし emerald）を role 配色に。共有ページ（measurements/meals/reports/analysis/customers[id]/templates/scheduled-reports）は `ac.btn`（店舗=緑/運営=紫）に統一。運営専用ページ（tenants/tenants[id]/tenants/new/plans/audit/staff）は常に紫に固定。scheduled-reports の選択チップも `ac.pillActive` に
- 据え置き: 「承認」緑ボタン（意味色）・LINE連携済み等の成功緑・ステータス色は不変。storeOnly ページ（billing/stores/SeatChangeModal）は店舗文脈のため緑のまま（＝店舗=緑で正しい）
- 影響範囲: 管理画面（/admin・/store）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック「ボタンも」

## 2026-06-03 – change(admin/store): レポート送付のフィルタを顧客分析と完全一致に（期間＋店舗チップ＋顧客プルダウンの1カード）（branch: staging）
- change: `app/admin/reports/page.tsx`。前回追加したステータスチップを撤去し、「期間(DateRangePicker)」と「顧客選択」を**1つのカードに統合**。顧客分析のフィルタバーと同一構成（DateRangePicker → 店舗チップ → 顧客プルダウン、ラベルなし・ステータスなし・店舗チップは常時表示）に。未使用化した statusFilter/STATUSES を削除
- 影響範囲: 管理画面（/admin・/store のレポート送付）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ192510「これと全く同じに」）

## 2026-06-03 – change(admin/store): レポート送付の顧客選択を進捗管理スタイルに（①②番号を廃止）（branch: staging）
- change: `app/admin/reports/page.tsx`。レポートモードの「① 顧客 / ② 期間 / ③ 送信元店舗 / ④ テンプレ」の番号付きステップ表示を廃止。顧客選択を「店舗チップ→顧客プルダウン→ステータスチップ」のクリーンな絞り込み（進捗管理/顧客分析と同じ・スクショ234829）に。`statusFilter`＋`STATUSES` 追加で候補を店舗×ステータスで絞り込み（選択中顧客が候補外になればリセット）。ラベルからも丸数字を除去
- 影響範囲: 管理画面（/admin・/store のレポート送付）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ1件）

## 2026-06-03 – change(admin/store): ブランドアクセントを role 配色に（店舗=緑 / 運営=紫）第1弾: サイドバー＋フィルタチップ（branch: staging）
- feat: `lib/adminAccent.ts` 追加。`adminAccent(isStore)` が role 別アクセントのクラス群（pillActive/btn/ring/text/bgSoft/border/dot）を返す。store=emerald(緑)/admin=violet(紫)。意味色（成功・ステータス・エラー・デモ等）には使わない
- change: `app/admin/AdminShell.tsx`。サイドバーのアクセントを store=violet/admin=emerald → **store=emerald(緑)/admin=violet(紫)** にスワップ（accentText/Bg/Dot/Ring/Glow）。トップバーのロールバッジは元から store=緑/admin=紫で整合
- change: 主要6ページ（customers/progress/meals/measurements/analysis/reports）のフィルタチップ（ステータス＝旧emerald・店舗＝旧violet）の選択中スタイルを `ac.pillActive` に統一。これで store では全て緑、admin では全て紫に。reports の TemplateChip は `accentActive` prop 経由
- 注: 「承認」緑ボタン・デモ紫バッジ・LINE連携済み緑 等の意味色は据え置き（Option A）。主要アクションボタン（保存/追加/送信）の role 配色化は第2弾で対応予定
- 影響範囲: 管理画面（/admin・/store）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（store=緑/admin=紫）

## 2026-06-02 – change(admin/store): レポート送付の顧客選択を顧客分析と同じ絞り込みUIに（店舗チップ追加）（branch: staging）
- change: `app/admin/reports/page.tsx`。レポートモードの「① 顧客」を、顧客分析と同じ「店舗チップ→顧客プルダウン」構成に。`selectedStore`＋`storeOptions`/`filteredCustomers` を追加し、店舗で顧客候補を絞り込み（店舗が2件以上の時のみチップ表示・選択中顧客が候補外になればリセット）。プルダウン文言は「顧客を選択してください」
- 影響範囲: 管理画面（/admin・/store のレポート送付）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ1件）。色テーマ（store=緑/admin=紫）は別途確認中

## 2026-06-02 18:44 – fix(reports): 月次/週次レポートの食事を「1日平均」に修正 ＋ 体重を「最終日の体重」に（branch: staging）
- fix: `lib/reports/variables.ts`。朝食/昼食/夕食/間食の `{breakfast_kcal}` 等が期間**合計**を返していた（テンプレ表記「平均/日」と不一致）バグを修正。記録日数 `totalDays` で割った**1日あたり平均**を返すように。これで「朝＋昼＋夕＋間 の平均/日」の合計が全体の1日平均 `{kcal}` と一致する。単日(前日)レポートは `totalDays=1` のため当日合計と一致＝従来挙動を維持
- fix: `{weight}` が `customer.currentWeight`（＝Notion `開始体重(kg)` の固定値）を出していたのを、**期間内の最終日の実測体重**に変更。無ければ開始体重にフォールバック。月次/週次/前日すべてに適用
- add: `lib/notion.ts` に `getLastWeightInRange(sheetPageId, start, end)` を追加（個人シートの記録テーブルから期間内で最も新しい有効体重を取得）。`buildReportVariables` に `lastWeight` 引数を追加
- add: テンプレ用変数 `{days}`（記録日数）/ `{total_kcal}` `{total_P}` `{total_F}` `{total_C}`（期間の真の合計）を追加。「月間合計」を**真の合計**で出したい場合に利用可（現状テンプレの月間合計は `{kcal}`＝1日平均を参照している点は別途要判断）
- chore: `app/api/admin/reports/generate/route.ts` ＋ `app/api/cron/daily-reports/route.ts` で `getLastWeightInRange` を呼び出し、`buildReportVariables` と AI生成(`generateReportComments`/`generateCoachingAnalysis`)に最終日体重を渡すように
- test: `__tests__/lib/report-variables.test.ts` 追加（1日平均・最終日体重・開始体重フォールバック・単日維持）。tsx で実関数を直接検証し全項目 PASS（vitest はこの環境に未インストール）
- 影響範囲: レポート送付（/admin・/store のレポート生成）＋ 定期配信 cron の**送信本文**。顧客が受け取るレポートに反映。LIFF UI・DB スキーマ変更なし。tsc 通過（既存 vitest 未解決エラーのみ）
- 関連: 社長指摘「朝食〜夕食が1日当たりの平均値ではない／月次・週次の体重は最終日の体重を記載して」

## 2026-06-02 – change(admin/store): サイドバー排他ハイライト ＋ 顧客プルダウン文言統一 ＋ 体組成を進捗管理スタイルのプルダウンに ＋ 大画面の左右余白を解消（branch: staging）
- change: `app/admin/AdminShell.tsx`（コンテンツ幅）。`main` の `max-w-5xl mx-auto` を撤廃し `w-full`（＋`lg:px-6`）に。大画面で中央寄せにより左右へ大きな余白（隙間）が出ていたのを解消し、PCサイズと同じく幅いっぱいに表示
- change: `app/admin/AdminShell.tsx`（サイドバー）。サイドバーのハイライトを**単一フォーカス（排他）**に。グループ展開中（矢印クリック）はトップ項目（現在地）の色を消し**展開した親のみ**色。子クリックで**親＋子**に色。グループ展開はアコーディオン化（progress/settings は同時に開かない）。`anyGroupOpen` 導入＋トップ項目の色判定を `active && !anyGroupOpen` に
- change: 顧客選択プルダウンの文言を全画面「**顧客を選択してください**」に統一。`app/admin/progress/page.tsx`・`app/admin/meals/page.tsx`（「すべての顧客」→。未選択=全件表示の挙動は維持）、`app/admin/reports/page.tsx`（「選択してください」→）。`analysis` は既に同文言
- change: `app/admin/measurements/page.tsx`（体組成計測記録）。前回の「検索駆動」を取り下げ、**進捗管理と同じ絞り込みUI**（店舗フィルタ＋顧客プルダウン「顧客を選択してください」＋ステータスフィルタ）に変更。プルダウンで顧客選択→登録フォーム・履歴。フィルタ変更時は選択リセット。未使用化した検索/StatusBadge/関連 import を整理
- 影響範囲: 管理画面（/admin・/store）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ2件）。※「大画面でのサイズ統一」は要確認のため別途

## 2026-06-01 – change(store): 顧客詳細の「ツアーリセット」を運営(/admin)専用に（店舗では非表示）（branch: staging）
- change: `app/admin/customers/[id]/page.tsx`（顧客詳細・店舗は同ファイルを re-export）。「ツアーリセット」セクション（ホーム＋食事記録の初回ガイド再表示）を `isStore`(`base === '/store'`) 判定で `{!isStore && (...)}` ラップ。運営(/admin)側のみ表示、店舗(/store)側は非表示に。DELETE API (`/api/admin/customers/[id]/onboarding`) は変更なし（運営からのみ実行）
- 影響範囲: 管理画面（/store の顧客詳細から該当UIが消える・/admin は不変）。顧客側 LIFF・API・DB 変更なし。tsc 当該ファイル通過
- 関連: 社長指示「store でオンボーディングリセットは不要、admin 側のみ表示」

## 2026-06-01 – change(progress): 進捗管理の「食事記録漏れ」「体重記載漏れ」バッジを削除（branch: staging）
- change: `app/admin/progress/page.tsx`。顧客リスト各行のステータス横に出していた **食事記録漏れ**（`foodGapLabel` / `daysSinceLastRecord`）と **体重記載漏れ**（`weightGapLabel` / `daysSinceLastWeight`）の記録漏れバッジを削除（社長指示「不要」）。未使用になった `RecordGapBadge` / `foodGapLabel` / `weightGapLabel` も除去し、`riskMap` を `{ weightStalled }` のみに簡素化
- 残置: **体重停滞**バッジ（`weightStalled`）は対象外のため継続表示。リスク取得API（`/api/admin/customers/risk-summary`）と cron 側の記録漏れ計算は変更なし（バッジ表示のみ撤去）
- 影響範囲: 管理画面（/admin・/store 進捗管理）の表示のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過（既存の vitest 未解決エラーのみ）
- 関連: 社長指示「体重記録漏れと食事記録のバッジ不要だから削除して」

## 2026-06-01 – change(admin/store): サイドバー展開時の親ハイライト ＋ タイトル文字サイズ統一 ＋ ロールバッジにアイコン ＋ 体組成を検索駆動に（branch: staging）
- change: `app/admin/AdminShell.tsx`。(1) 進捗管理／設定グループを**展開した時に親もアクセント色**で点灯（従来は子がアクティブな時のみ。`progressActive`→`progressOpen` / `settingsActive`→`settingsOpen`。左アクセントバーは現在地のみ維持）。(2) トップバーのページタイトルを `text-sm`→`text-base` にしサイドバーメニューと同サイズに。(3) ロールバッジ（店舗/アドミン）に `w-4 h-4` アイコン（店舗=Store / アドミン=ShieldCheck）を追加し、ベルアイコン(`w-4 h-4`)とサイズを統一
- change: `app/admin/measurements/page.tsx`（体組成計測記録）。顧客選択を**検索駆動**に変更。初期は検索バーのみ表示（一覧・フィルタ非表示）、氏名検索した時のみ候補一覧＋フィルタを表示→クリックで登録画面へ。空検索時は「氏名で検索すると顧客が表示されます」ヒント
- 影響範囲: 管理画面（/admin・/store）のシェル＋体組成記録のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ2件）

## 2026-06-01 – change(admin): 顧客リストを縦1列リストへ戻す ＋ 招待URLコピーを検索下へ移動 ＋ 体組成記録の顧客検索を顧客管理と同じUI/UXに（branch: staging）
- change: `app/admin/customers/page.tsx`。(1) 顧客一覧を `grid md:grid-cols-2 xl:grid-cols-3`（393c714 のレスポンシブグリッド）から元の `divide-y` 縦1列リストへ戻す（社長指示・スクショの縦リストに統一）。(2)「招待URLをコピー」ボタンを検索カード（氏名検索＋ステータス／店舗フィルタ）の上→下へ移動。上限到達時ツールチップ等の挙動は不変
- change: `app/admin/measurements/page.tsx`（体組成計測記録）。顧客選択を `<select>` ドロップダウンから、顧客管理と同じ「検索バー＋ステータス／店舗フィルタ pill＋クリック可能な縦1列カード一覧（名前・各種バッジ・体重/目標kcal/PFCの2行）」に刷新。選択後は「選択中の顧客＋別の顧客を選ぶ」ヘッダー→既存の記録フォーム・履歴へ。`/api/admin/stores` を追加取得、`StatusBadge` を移植
- 影響範囲: 管理画面（/admin・/store）のみ。顧客側 LIFF・API・DB 変更なし。tsc 通過
- 関連: 社長フィードバック（スクショ3件）。393c714 のタブレット向けグリッド最適化を顧客管理では取り下げ（要なら別途タブレット対応を再設計）

## 2026-06-01 – perf(progress)+style(record): 進捗管理の表示高速化 / 「テキスト記録」カードの2行折返し解消（branch: staging）
- perf: `app/api/admin/progress/route.ts` の食事・体重・運動の3データ取得フェーズを**直列→並列(`Promise.all`)化**。各フェーズは progress の別フィールド（today/weight/exercise）にのみ書くため競合なし。直列だと Notion 往復＋リトライが積み上がり、進捗管理(/store/progress)の顧客表示が ~10秒かかっていたのを短縮（体感の主因に対処）
- style: `app/record/page.tsx` の食事記録ハブのカード「テキストで記録」(7文字)が iPhone のカード幅で2行に折返していたため、ラベルを「テキスト記録」(6文字・他カードと同じ収まり)に変更。フォントサイズは他カードと統一のまま1行に
- 影響範囲: 管理画面API(/api/admin/progress＝/store・/admin 進捗管理) / 顧客側 LIFF(/record カード表示)。ロジック・データ内容は不変
- 関連: 社長報告（進捗管理が10秒/IMG_4755 テキストカード2行）。残: サイドバー選択色・見出しフォント・バッジ/お知らせアイコンのサイズ調整は AdminShell（並行作業中）のため要調整
## 2026-06-01 – fix(account.delete): 健康データ削除を同期化（削除漏れ修正・件数を応答に）
- fix: `DELETE /api/account` のカスケード削除（食事/体重/体組成/運動）を **background(waitUntil) から同期 await に変更**。応答前に削除を完了。background だとテナント AsyncLocalStorage context 喪失/未完了で**健康データが消えず PII 残存**する事象を staging 検証で確認（顧客アーカイブ済だが食事4/体重2 残存）→ 法的削除の確実性を優先
- fix: 削除件数を応答に含める（`{ ok, deleted: {...} }`）＋監査 outcome を purge 成否で出し分け
- 影響範囲: 顧客側 LIFF（アカウント削除）。staging・本番 両方。tsc／本番build パス
- 既知: 同一 lineUserId が複数テナントに重複登録なら削除はリクエスト側テナントのみ（テナント別＝別アカウント）。Drive 写真は未削除（GAS残課題）
- 関連: 社長の削除テスト検証（削除が顧客アーカイブのみで健康データ残存）

## 2026-06-01 – fix(exercise-log): 運動保存を「顧客null でも続行」に変更（体重と同挙動）＋原因ログ
- fix: `app/api/exercise-log` で `getCustomerByLineId` が null（顧客が見つからない）でも **404 にせず運動記録を保存**（customerName は表示用のみのため `?? ''`）。体重保存(`/api/log/weight`)が既に採用している `.catch(()=>null)`＋null許容 と同方式に統一
- 経緯: staging で「運動保存に失敗: 顧客が見つかりません」が恒常的に発生（ホームには顧客の体重目標が表示されるのに運動だけ顧客null）。テナント解決の食い違い（`FITMEAL_TENANT_ID_OVERRIDE` 絡み）が疑われるが、まず体重と同じ寛容挙動でブロック解消。`console.error` に tenant/lineUserId を記録し根本原因を追跡可能に
- 影響範囲: 顧客側 LIFF（運動記録の保存）。staging・本番 両方。tsc／本番build パス
- 関連: 社長報告（運動保存エラー）

## 2026-06-01 – perf(store): 通知設定トグル（リスクお知らせON/OFF）の体感即時化＋保存高速化（branch: staging）
- fix(UI): `app/store/notifications/page.tsx` のトグルを楽観的更新に変更。クリックで即スイッチを反映し保存はバックグラウンド実行、失敗時のみロールバック（旧実装は Notion 書き込み完了まで〜5秒スイッチが動かず disabled だった）
- perf(API): `app/api/admin/tenant-settings` PATCH が pageId 取得のためだけに全テナントDBを毎回 Notion クエリしていたのを、解決済みテナントの `notionPageId`（resolver 5分メモリキャッシュ）利用に変更。トグル保存の Notion 往復が 2回→1回（書き込みのみ）に短縮。`lib/tenant.ts` に `notionPageId?` 追加・`lib/tenantResolver.ts` で設定。未設定時は従来の listTenantRows クエリにフォールバック
- 影響範囲: 店舗(/store 通知設定)・API・lib バックエンド。顧客側UI・DBスキーマ変更なし
- 関連: 社長フィードバック「ON/OFF 切替が即時でない（〜5秒かかる）」

## 2026-06-01 – fix(repo): 体重/運動/体組成 保存の間欠エラーを修正（Notionリトライ追加）
- fix: `lib/repository/weightLogs.ts`・`exerciseLogs.ts`・`bodyComposition.ts` の自前 `notionRequest` に、中央 `lib/notion.ts` と同方式の**リトライ（429/502/503/504・ネットワーク断を指数バックオフ最大3回＋30sタイムアウト）**を追加
- 経緯: これら3 repo は中央のリトライ処理を使わず単発 fetch だったため、Notion の一時障害で**体重/運動/体組成の記録保存が間欠的に失敗**（「記録が保存できませんでした」）していた。staging で再現報告
- 影響範囲: バックエンド（顧客の体重/運動/体組成 記録保存の信頼性向上）。staging・本番 両方に反映。tsc／本番build パス
- 関連: 社長報告（staging 体重/運動 保存エラーがぶり返す）

## 2026-06-01 – style(store/admin): 顧客一覧をタブレット/PCで複数カラム化（レスポンシブグリッド・第1弾）（branch: staging）
- style: `app/admin/customers/page.tsx`（/store・/admin 共有の顧客一覧）の一覧を、縦1列の divide-y リストから**レスポンシブなカードグリッド**に変更（`grid md:grid-cols-2 xl:grid-cols-3`）。各顧客を独立カード化（hover で shadow）。モバイルは従来どおり1列、タブレットで2列、大画面で3列
- 背景: AdminShell は既に max-w-5xl＋レスポンシブサイドバー化済みだが、各ページの中身が単一カラムで広い画面幅を活かせていなかった。その第1弾として着地ページ（顧客一覧）を最適化し、方向性確認後に他の一覧/フォーム系ページへ横展開予定
- 影響範囲: 管理画面（/store・/admin の顧客一覧）の表示のみ。ロジック・データ取得・遷移は不変（className のみ）
- 関連: 社長指示「store画面をタブレット最適化」。AdminShell のレスポンシブ化（別作業 1c69ba2 等）に続くページ内部の最適化

## 2026-06-01 – change(admin/store): サイドバーのロゴ/アイコン拡大・ロールバッジをトップバーへ移動・メニュー文言を拡大（branch: staging）
- change: `app/admin/AdminShell.tsx`。ブランドのアイコン(h-9→h-12)とロゴ(h-5→h-7)を拡大、ブランド行は h-16 据置
- change: 「店舗/アドミン」ロールバッジをサイドバー上部からトップバー右（お知らせベルの右隣）へ移動。店舗=ベル＋バッジ、運営=バッジのみ
- change: サイドバーのメニュー文言（項目・グループ見出し・フッターのパスワード変更/ログアウト）を text-sm→text-base に拡大
- 影響範囲: 管理画面（/store・/admin）のシェル表示のみ。挙動・ロジック・ロール出し分けは不変。顧客側 LIFF・API・DB 変更なし。tsc/eslint/`next build` 通過
- 関連: 社長フィードバック（ロゴ大きめ・バッジ位置・文言拡大）

## 2026-06-01 – feat(admin/store): 管理画面ナビを常時表示の左サイドバーに刷新（モバイル/タブレット/PC対応）（branch: staging）
- feat: `app/admin/AdminShell.tsx`（/store・/admin 共通シェル）のナビを、上部の横タブ＋ドロップダウンから「左サイドバー（アプリシェル）」レイアウトに刷新。md 以上（タブレット・PC）ではサイドバーを常時固定表示して画面全体を使い、モバイル（< md）ではハンバーガーで開くドロワー＋背面オーバーレイに切替
- feat: 選択中の項目を背景・左アクセントバー・リング＋グロー（影）でハイライト（「クリックで階層が光る」）。進捗管理／設定はサイドバー内の開閉グループにし、現在地のグループは自動展開
- 仕様維持: TABS 構成・ロール別表示（master/tenant_admin・storeOnly/masterOnly）・me 取得＋キャッシュ・ログアウト・店舗お知らせ未読バッジ・戻るボタン・アクセント配色（store=violet/admin=emerald）は従来どおり
- cleanup: 誤って追加していた到達不能の `app/store/(protected)/store/layout.tsx`（dead route layout）を削除
- 影響範囲: 管理画面（/store・/admin）のレイアウトのみ。顧客側 LIFF・API・DB 変更なし。tsc／eslint／`next build` 通過。staging 検証 → 社長確認 → main
- 関連: Square 管理画面を参照したフルスクリーン・サイドナビ化の要望

## 2026-06-01 – style(date-nav): 日付選択の左右矢印を絵文字からアイコン(lucide Chevron)に変更（branch: staging）
- style: 日付ナビの左右矢印を絵文字 `◀`/`▶`（端末依存の青系トライアングル絵文字でレンダリングされていた）から lucide-react の `ChevronLeft`/`ChevronRight` に置換。アプリ内の他アイコンと統一し currentColor で配色も馴染ませた
- 対象（顧客側）: `app/home/_components/DateStrip.tsx`（ホーム週間日付ストリップ）/ `app/record/page.tsx`（記録の日付セレクタ）/ `app/my-menu/page.tsx`（マイメニューの日付）/ `app/food-search/page.tsx`（食品DB検索の日付）。同種の日付前後ナビ全箇所を一括で統一
- 影響範囲: 顧客側 LIFF の表示のみ（onClick・aria-label 等の挙動は不変）。`next build` コンパイル成功
- 関連: 社長 iPhone SE2 実機指摘（IMG_4752 記録 / IMG_4753 ホーム）

## 2026-06-01 – fix(notion): 登録直後の「顧客が見つかりません」（運動/体重保存エラー）を本番へ反映
- fix: `getCustomerByLineId` の「顧客なし(null)」キャッシュ TTL を 30分→**15秒**（`CUSTOMER_NOTFOUND_CACHE_TTL_MS`）＋ `createCustomer` で当該 lineUserId の個別キャッシュを `invalidate`
- 経緯: staging で効果確認済（運動/体重の記録が「顧客が見つかりません」で落ちる事象の根本対策）→ 本番にも反映。本番でも新規登録顧客が同事象に遭う潜在バグのため
- 影響範囲: バックエンド `lib/notion.ts` のみ。本番のリトライ処理は維持（キャッシュ箇所のみ手術的に適用）。tsc／本番build パス
- 関連: 社長報告（staging で運動/体重保存エラー）

## 2026-05-31 – feat(admin/store): 顧客詳細にツアーリセット（オンボーディング再表示）ボタンを復活
- feat: `app/admin/customers/[id]/page.tsx`（/store・/admin 顧客詳細）に「ツアーリセット」セクションを復活。`DELETE /api/admin/customers/[id]/onboarding`（既存・健在）を呼び `onboardingCompletedAt=null`＋`tourResetAt` を更新 → 顧客が次回 LIFF 起動時にホーム＋食事記録ツアーを再表示
- 配置: 目標(PFC)セクションの直下・アカウント削除の直上。顧客管理（顧客詳細）にのみ追加
- 復元元: 5セクション削除（`0132322`）で消えた `resetOnboarding` ハンドラ＋state＋ボタンUIを当時のまま復元（`RotateCcw` import 追加）。バックエンドAPIは変更なし
- 影響範囲: 管理画面（/store・/admin 顧客詳細）のみ。顧客側UI・DBスキーマ変更なし。tsc／本番build パス。staging・本番 両方へ反映
- 関連: 社長依頼

## 2026-05-31 – fix(favicon): FitMeal ロゴのタブ表示サイズを他タブと統一（main直反映・社長指示 / commit 3701b2a）
- fix: 丼ロゴ周囲の透明余白を切り詰め、`app/favicon.ico`・`public/fitmeal-favicon.png` を再生成。タブ内のロゴ充填率を 78%→95% に拡大し、メヲダス等の他タブ favicon と見た目サイズを揃えた（`fitmeal-icon.png` マスターは不変、favicon 派生ファイルのみ再生成）
- 影響範囲: 顧客側 LIFF 含む全画面のタブアイコン（表示のみ・機能影響なし）。ブラウザの favicon キャッシュが強いため、反映には強制リロード/キャッシュ削除が必要な場合あり
- 関連: 直前の favicon 統一 commit 49f6d91 の見た目調整

## 2026-05-31 – chore: ファビコンを FitMeal ロゴに統一（main直反映・社長指示 / commit 49f6d91）
- chore: ブラウザタブ/PWA アイコンを旧 `/icon.svg`（緑「メ」）から FitMeal ロゴに変更。`public/fitmeal-favicon.png`（256px）追加、`app/layout.tsx` の `metadata.icons`・`app/manifest.ts`・`app/store/manifest.ts` の icons を差し替え、`app/favicon.ico` を fitmeal-icon.png から再生成
- 反映方法: staging(4d0fc60)検証済 → 社長OK後、favicon関連の **対象5ファイルのみ** main に取り込み（staging の未承認機能=リスク配信/アカウント削除カスケード等は持ち込まない）
- 影響範囲: 顧客側 LIFF 含む全画面のタブアイコン（表示のみ・機能影響なし）

## 2026-05-31 – hardening(notion): notionFetch に 30s タイムアウトを追加
- hardening: `lib/notion.ts` `notionFetch` の各 fetch に `AbortSignal.timeout(30_000)` を設定し、Notion 応答ハング時に Vercel Function を掴み続けない様に。タイムアウト/ネットワーク断は catch して既存の指数バックオフリトライ対象に組み込み（最大3回）。リトライ自体は PR #36 で導入済のため本変更は timeout ガードのみ
- 影響範囲: API（Notion を呼ぶ全エンドポイント）。正常時の挙動は不変（30s 超過は実質ハングのみ）
- 関連: Sentry 週次レポート Notion API 502 / PR #37（#36 と重複のためクローズ、本PRで timeout 部分のみ救済）

## 2026-05-31 – perf(notion): billing/info の listTenantRows 重複呼び出しを解消（2→1）
- perf: `lib/seats.ts` `getSeatStatus` に `tenantRows`（取得済みテナント行 or その Promise）オプションを追加。`app/api/admin/billing/info/route.ts` は `listTenantRows` を 1 回だけ呼び、その Promise を `getSeatStatus` にも共有することで、1 リクエストで同一 Notion クエリが 2 本飛んでいた状態を 1 本に削減（Promise 共有のため並列性・レスポンス時間は維持、キャッシュ挙動・他の getSeatStatus 呼び出し元は不変）
- 影響範囲: API（/api/admin/billing/info）・lib バックエンド。顧客側 UI 影響なし
- 関連: PR #36 の後続対応（Sentry: Notion API 502 at /api/admin/billing/info の発生確率低減）

## 2026-06-01 – fix(cron): リスクお知らせ自動配信の dedupe が毎回すり抜ける重複作成バグを修正（branch: staging）
- fix: `app/api/cron/daily-reports/route.ts` の「【本日の要注意顧客 N名】」お知らせ当日重複判定を、UTC の `createdAt`（Notion `created_time`）比較から、作成時に JST 日付で書き込む `publishedAt`（公開日）比較に変更
- 原因: cron は `vercel.json` で `0 21 * * *`（21:00 UTC = 6:00 JST）に発火。dedupe の `todayDate` は `jstNow()` ベースの JST 日付だが、`a.createdAt.slice(0,10)` は UTC 日付のため、00–09時JST のあいだ（＝まさに cron 実行時刻）は前日扱いになり、当日作成済みのお知らせを1件も拾えず `already_sent` 判定が常に false → 再実行のたびに重複作成していた
- 修正により再実行時は `already_sent` で正しくスキップ。`targetTenants` flatten・page_size 100 ページングは問題なし（新しい順で当日分は先頭に来るため取りこぼしなし）
- 影響範囲: API / cron（バックエンド）のみ。顧客側UI・DB スキーマ変更なし
- 関連: ハンドオフ #1（最優先）。staging 検証（cron 再実行で already_sent 確認）→ 既存重複お知らせ掃除 → fitmeal-qa → 社長OK後に main

## 2026-06-01 – fix(onboarding): iPhone SE2 で吹き出しが枠外に切れる/ツアー中に下要素がタップ反応する問題を修正（branch: staging）
- fix(枠外): `components/OnboardingFlow.tsx` のスポットライト吹き出しを常に対象の上に固定していた実装を、`SpotlightCallout` に統合。吹き出しの高さを実測し「上 or 下の収まる方」へ自動配置、どちらにも入りきらない縦長対象（食事カード群など）や画面端では viewport 内にクランプ。SE2(667px) でタイトル＋本文先頭が LIFF ヘッダー裏に切れる事象を解消。対象は StepMealCards / StepWeightIntro / StepExerciseIntro（StepFooterRecord は元々下端配置で問題なく据え置き）
- fix(タップ透過): `components/OnboardingTour.tsx`（/record・/weight・/exercise ツアー）のルートが `pointer-events-none` で全面ブロッカーが無く、ツアー中に下の実要素（「朝食は食べなかった」等）がタップに反応して別ページ遷移/確認ダイアログが出ていた。透明な全面ブロッカー（pointer-events-auto）を追加し、タップを吸収。ツアーはツールチップのボタンでのみ進む。スポットライト未取得時はブロッカーが暗転も兼任。※ホーム(OnboardingFlow)はルートが pointer-events 有効で元々ブロック済み
- 影響範囲: 顧客側 LIFF のオンボ/ツアー表示のみ。`next build` コンパイル成功
- 関連: 社長 iPhone SE2 実機確認（IMG_4750 枠外 / IMG_4751 タップ反応）。カクつき修正(5b1be08)の実機フォロー
- fix: `app/api/cron/daily-reports/route.ts` の「【本日の要注意顧客 N名】」お知らせ当日重複判定を、UTC の `createdAt`（Notion `created_time`）比較から、作成時に JST 日付で書き込む `publishedAt`（公開日）比較に変更
- 原因: cron は `vercel.json` で `0 21 * * *`（21:00 UTC = 6:00 JST）に発火。dedupe の `todayDate` は `jstNow()` ベースの JST 日付だが、`a.createdAt.slice(0,10)` は UTC 日付のため、00–09時JST のあいだ（＝まさに cron 実行時刻）は前日扱いになり、当日作成済みのお知らせを1件も拾えず `already_sent` 判定が常に false → 再実行のたびに重複作成していた
- 修正により再実行時は `already_sent` で正しくスキップ。`targetTenants` flatten・page_size 100 ページングは問題なし（新しい順で当日分は先頭に来るため取りこぼしなし）
- 影響範囲: API / cron（バックエンド）のみ。顧客側UI・DB スキーマ変更なし
- 関連: ハンドオフ #1（最優先）。staging 検証（cron 再実行で already_sent 確認）→ 既存重複お知らせ掃除 → fitmeal-qa → 社長OK後に main

## 2026-06-01 – perf(onboarding): iPhone でオンボのスポットライトがカクつく問題を修正（branch: staging）
- perf: `components/OnboardingFlow.tsx`（/home オンボ）と `components/OnboardingTour.tsx`（/record・/weight・/exercise ツアー）のスポットライト位置追跡を最適化。原因は smooth scroll 中に大量発火する `scroll` イベントごとに `getBoundingClientRect()`＋`setState`（全画面 box-shadow 再描画）を非スロットルで実行し、iOS WebView で強制レイアウト＋再描画ストームが発生していたこと
- 修正内容: ①scroll/resize ハンドラを `requestAnimationFrame` スロットル化＋`{ passive: true }` 化 ②`scrollIntoView` はステップ入場時に1回だけ（旧: ハンドラ内で毎回呼び自己再帰的に揺れていた）③矩形が実質変化しない場合は `setState` をスキップして再レンダー抑止 ④`transition: all`／`transition-all` をスポットライトから除去（毎フレーム更新される top/left を CSS トランジションが追従して遅延していたため）
- OnboardingFlow: step 2/3/5/6 の3つの重複 useEffect を単一の追跡 effect に統合（クロス effect での null 上書きの脆さも解消）。対象セレクタ・scrollIntoView 対象は従来と同一で挙動維持
- 影響範囲: 顧客側 LIFF（/home・/record・/weight・/exercise のオンボ/ツアー表示）。機能は不変、描画パフォーマンスのみ改善。`next build` コンパイル成功（型エラーは vitest devDep 未インストールのローカル環境要因のみで本変更とは無関係）
- 関連: 社長報告（iPhone 録画 ScreenRecording 05-31）。staging 検証 → 社長 iPhone で体感確認 → OK後に main

## 2026-05-31 – fix(notion): 登録直後の「顧客が見つかりません」（運動/体重保存エラー）を修正
- fix: `getCustomerByLineId` の「顧客なし(null)」キャッシュ TTL を 30分 → **15秒**に短縮（`CUSTOMER_NOTFOUND_CACHE_TTL_MS`）。登録前に開いた等で stale な null が残り、登録直後に別インスタンスで運動/体重保存が「顧客が見つかりません」(404)になる事象の根本対策
- fix: `createCustomer`（登録）時に当該 lineUserId の個別キャッシュ `${tenantId}:customer:${lineUserId}` を `invalidate`。登録を処理したインスタンスは即時に新顧客を解決可能に
- 症状: 食事は通る（別インスタンス）が運動/体重だけ「顧客が見つかりません」になる不整合。両者とも `getCustomerByLineId` 必須だが、null を30分キャッシュしたインスタンスに当たると落ちていた
- 影響範囲: バックエンド `lib/notion.ts` のみ。顧客側の登録→記録フローのバグ修正。tsc／本番build パス。staging→確認後 本番へ
- 関連: 社長報告（staging で運動/体重保存エラー）

## 2026-05-31 – feat(admin/store): 顧客詳細にツアーリセットボタンを復活（staging / 本番にも同時反映）
- feat: `app/admin/customers/[id]/page.tsx`（/store・/admin 顧客詳細）に「ツアーリセット」セクションを復活。`DELETE /api/admin/customers/[id]/onboarding`（既存・健在）を呼び `onboardingCompletedAt=null`＋`tourResetAt` 更新 → 顧客の次回 LIFF 起動でツアー再表示
- 配置: 目標(PFC)直下・アカウント削除の直上。顧客管理のみ。`0132322` で消えた実装を当時のまま復元（`RotateCcw` import 追加）
- 影響範囲: 管理画面のみ。顧客側UI・DB変更なし。tsc／本番build パス
- 関連: 社長依頼。本番 main にも反映済（commit f977e75）

## 2026-05-31 – chore: ファビコンを FitMeal ロゴに統一（branch: staging / 全画面ブラウザタブ）
- chore: ブラウザタブ/PWA アイコンを旧 `/icon.svg`（緑「メ」）から FitMeal ロゴに変更。`public/fitmeal-favicon.png`（fitmeal-icon.png を 256px 化）を新規追加し、`app/layout.tsx` の `metadata.icons`（icon/apple）と `app/manifest.ts` の icons を差し替え。`app/favicon.ico`（Next 規約・/favicon.ico 自動配信）も fitmeal-icon.png からマルチサイズ再生成し、ブラウザのデフォルト取得先も FitMeal ロゴに統一
- 影響範囲: 顧客側 LIFF 含む全画面のタブアイコン（表示のみ・機能影響なし）。staging 検証 → 社長OK後に main
- 関連: メヲダス intake 側のファビコン追加は HP リポジトリで別途対応済み（mewodas.com アイコン）


- feat: `riskAlertEnabled`（既定 false）をテナント設定に追加（`lib/notion.ts` TenantRow・`updateTenantRow` パッチ・`listTenantRows` パース・`lib/tenant.ts` TenantConfig・`lib/tenantResolver.ts` ロード）。Notion DB カラム名「リスクアラート」(checkbox)
- feat: `/api/admin/tenant-settings` GET/PATCH に `riskAlertEnabled` を追加。店舗(tenant_admin)が自テナントの設定のみ変更可能
- feat: `/store/notifications` 新規ページ（トグル UI）。AdminShell の設定ドロップダウンに「通知設定」タブを追加（storeOnly）
- feat: `app/api/cron/daily-reports/route.ts` にリスクお知らせ処理を追加（レポート配信ループと独立）。`riskAlertEnabled=true` のテナントのみ `computeAndStoreTenantRisk` → `listCustomerRiskByTenant` → `createAnnouncement`（audience='店舗向け'）。dedupe: 当日タイトル「【本日の要注意顧客」+ targetTenants で重複スキップ。該当者0名の日は作成しない
- 影響範囲: 管理画面・API・Cron。顧客側 LIFF 変更なし
- マルチテナント: 越境禁止は targetTenants を各テナントID に限定することで担保

## 2026-05-31 – security(P1残): アカウント削除のPIIカスケード（branch: security/account-delete / staging検証前）
- security: `DELETE /api/account`（顧客の自己アカウント削除）を、顧客アーカイブのみ → **全健康データの物理削除カスケード**に拡張。`verifiedLineUserId` に厳密スコープして食事記録(Notion)・体重ログ・体組成ログ・運動ログを削除し、Neon `customer_risk` 行も物理削除（`deleteCustomerRiskByLineUser` 追加）。個人情報保護法の「削除権」対応
- 実装: 顧客アーカイブ＋customer_risk 削除は即時、健康データ一括削除は `waitUntil` で背景実行（maxDuration 60s）。各削除は try/catch で部分失敗でも続行、削除件数を `account.delete` 監査ログに記録
- ⚠️ 既知の残課題: Drive 上の食事/体組成**写真は未削除**（GAS 側に削除手段が無い）。監査ログに `driveImages: not_deleted_gas_unsupported` を記録。GAS 削除エンドポイント実装が別途必要
- 影響範囲: 顧客側 LIFF（アカウント削除）。**不可逆操作のため staging で test 顧客により fitmeal-qa＋社長確認 → main 必須**
- 関連: 監査 project_security_audit_2026_05_31 P1残


## 2026-05-31 – security(#6/#8): CSP違反収集エンドポイント＋Sentry PIIスクラブ強化
- security(#6): `app/api/csp-report/route.ts` 新規（CSP違反の report-uri 受け口・無認証・本文16KB上限・https違反のみ console+Sentry に記録）。`next.config.ts` の CSP（Report-Only 据え置き）に `report-uri /api/csp-report` を追加し、connect-src に GAS(`script.google*`)・Sentry(`*.ingest.sentry.io`) を補強。**enforce 化はこの実違反データで allowlist を完成させてから再挑戦**（凍結継続）
- security(#8): `lib/sentry.ts` `redactEvent` 強化。①画像 data URI 伏字の JSON 破壊バグ修正（旧実装は unredacted フォールバックしていた）②Bearer トークン/Authorization・Cookie ヘッダ/admin_session を伏字追加。`__tests__/lib/sentry-redact.test.ts`(6ケース) で回帰ロック
- 影響範囲: CSP は Report-Only のまま顧客 LIFF 影響なし（report-uri 追加のみ）。Sentry/csp-report はバックエンド。本番ビルド・tsc・テスト通過
- 関連: 監査 project_security_audit_2026_05_31 設計#6/#8、[[project_pending_security_2026_05_19]]

## 2026-05-30 09:00 claude/sec-fix-6543739
- fix: `lib/notion.ts` `notionFetch` に 502/503/504/429 対象の指数バックオフリトライ（最大3回）を追加
- 影響範囲: API（Notion 経由の全エンドポイント）
- 関連: Slack #security-alerts 1780070684.745729（Sentry: Notion API 502 at /api/admin/billing/info）


- security: `proxy.ts` で /admin・/store の状態変更（POST/PUT/PATCH/DELETE）を**同一オリジン必須**化（Origin ヘッダと Host を照合、不一致は 403 `csrf_origin_mismatch`）。Cookie セッション認証の外部サイト起点強制リクエスト（CSRF）を封鎖
- 影響範囲: /api/admin・/api/store の状態変更のみ。顧客 LIFF は Bearer 認証で非該当、Stripe webhook/cron・GET は対象外。SameSite=lax 維持（CSRF 実装により strict 不要）
- 補足: CSP enforce 化は LIFF「failed to fetch」で**見送り（Report-Only 据え置き）**。enforce は report-to による実違反収集後に再挑戦予定（[[project_pending_security_2026_05_19]]）
- 関連: 監査 project_security_audit_2026_05_31 設計#6


- test: `vitest`（+ `@vitest/coverage-v8`・`vite-tsconfig-paths`）を devDependency 追加、`vitest.config.ts`・`npm test` スクリプト整備
- test: `__tests__/lib/auth-token-separation.test.ts` 追加（14 ケース・全パス）。P0 CRITICAL「リセット/招待/legacy/role欠落 トークンの admin_session 流用による master 昇格」が再発しないことを保証（verifySession は typ=session かつ role 有効のみ受理、verifyResetToken は逆方向の混同も拒否）
- 影響範囲: 開発ツールのみ（本番ランタイム・顧客側に影響なし、`next build` は __tests__ を無視）。本番ビルド・tsc 通過確認済
- 関連: 監査 project_security_audit_2026_05_31 設計#10（クロステナント pageId→403 の integration テストは Notion モックが要るため後続）


- security: **同一テナント内クロス顧客 IDOR 封鎖**。`lib/notion.ts` `assertFoodRecordOwnership(pageId, expectedLineUserId?)` に所有者(LINE_UserID)照合を追加し、`app/api/record/update`・`app/api/delete` から `verifiedLineUserId` を渡す。他顧客の食事記録を pageId 指定で改竄/削除できる脆弱性を封鎖（管理API＝運営/店舗は省略でテナント所属チェックのみ＝全顧客操作可、不変）
- security: **通知既読の IDOR 封鎖**。`lib/notifications.ts` `markNotificationRead(id, expectedLineUserId?)` に所有者(LINEユーザーID)照合を追加、`app/api/notifications/[id]/read` から `verifiedLineUserId` を渡す（他顧客通知の既読化を防止）。不一致は 403
- security: **`/api/record/nutrition-label` 認証必須化**。素の POST を `withLiffTenant` で保護（無認証の Gemini コスト濫用を封鎖）。呼び出し元 `app/record/page.tsx` は apiFetch 経由で Bearer 付与済のため正常動作
- 影響範囲: 顧客側 LIFF（記録編集/削除・通知既読・栄養成分ラベル解析）＋ バックエンド lib。**staging で fitmeal-qa 検証後、社長確認 → main**
- 関連: 監査メモ project_security_audit_2026_05_31（P1 残の LIFF 系）


- security: **Stripe プラン整合性**。`app/api/stripe/checkout`・`update-seats` で `getPlanByCode` 取得後に `!plan.published || !plan.active` を拒否（非公開/無効の内部・PoCプラン選択を封鎖）。最低席数を `Math.max(plan.minSeats, MIN_SEATS=3)` で下限固定（minSeats=1 等のバイパス防止）
- security: **ログイン ブルートフォース対策**。`app/api/admin/auth/login` に per-email/IP の試行制限（15分で8回失敗→15分ロック、429+Retry-After）。成功で解除。reset-password と同じ in-memory 方式（永続化は設計#7で別途）
- security: **`/api/public/apply` 無認証クロステナント登録**。`getSeatStatus().isOverLimit` 超過を 409 で拒否（seat バイパス・スパム抑止、契約前=seatLimit null は非ブロック）。指定テナント未解決時は既定(mewodas)へ誤登録せず 404
- 影響範囲: API（/api/stripe/*・/api/admin/auth/login・/api/public/apply）。顧客側UI影響なし。再ログイン副作用なし（auth トークン形式は不変）
- 挙動変更（要把握）: 非公開プランでの自己申込/席数変更は 403。席数上限到達テナントへの apply は 409。タイポ等で店舗未解決の apply は 404（従来は mewodas へ登録されていた）
- 関連: 監査メモ project_security_audit_2026_05_31。LIFFレコード所有者照合/nutrition-label認証/notification read は顧客側=staging で別途


- change: `app/admin/customers/[id]/page.tsx`（/store・/admin 顧客詳細）のアカウント削除セクションから、赤カードの枠・見出し「アカウント削除」・説明文を撤去し、「アカウントを削除する」ボタン単体に変更（削除動作・確認ダイアログ `deleteAccount` は不変）
- 影響範囲: 管理画面（/store・/admin 顧客詳細）。見た目のみ・DB/API/顧客側UI 影響なし
- 検証: `tsc --noEmit` 0件 / `next build` パス

## 2026-05-31 – fix(admin/store): 目標カロリー/PFC/％ 連動を改修（脂質連動バグ修正・整数化・100%案内）
- fix: 目標カロリー変更時に脂質(F)を含む P/F/C すべてを各％から明示再計算するよう変更（従来のグラム比例スケールで脂質が動かないように見える問題を解消）。`app/admin/customers/[id]/page.tsx`
- change: PFC(g) を整数表示に統一（小数廃止）。読込・自動計算・編集の全経路で `Math.round`、g入力の step を 1 に
- change: 連動モデルを変更。①目標カロリー編集→各％維持で全 grams 再計算 ②PFC(g)編集→そのマクロの％のみ更新 ③％編集→そのマクロの grams のみ更新。**②③は他マクロを自動調整しない**（従来の按分・kcal再計算を廃止）
- feat: PFC 合計が目標カロリー(=100%)とズレた際に案内バナー表示 — 超過=赤（+kcal）／未達=橙（残り％・kcal）／一致=緑。`macroTotal` を grams+kcal から算出
- 影響範囲: 管理画面（/store・/admin 顧客詳細の目標カロリー/PFC 設定）。DB・保存ペイロード（goals.kcal/P/F/C）変更なし
- 検証: `tsc --noEmit` 0件／挙動シミュレーション（kcal変更で F も連動・整数・超過/未達案内）確認済
- 関連: 社長フィードバック（脂質が連動しない・小数不要・他％は連動せず100%超過/未達を案内）

## 2026-05-31 – change(admin/store): 顧客詳細から 体重推移/運動記録/送信履歴/レポート送付/ツアーリセット の表示を削除
- change: `app/admin/customers/[id]/page.tsx`（/store・/admin 顧客詳細）から以下5セクションの表示を削除 — ①体重推移グラフ＋運動記録 ②運動記録（新DB）③送信履歴 ④レポート送付（前日レポート送付）⑤ツアーリセット
- cleanup: 連動して不要になった state・ハンドラ（`loadWeightHistory`/`loadExerciseLogs`/`sendReport`/`resetOnboarding`）・型（`Notification`/`WeightEntry`/`ExerciseLog`）・通知取得 useEffect・ローカルチャート（`WeightLineChart`/`ExerciseBarChart`）・recharts と未使用 lucide import を撤去。`StatusInfoPopover`（ステータス説明ポップオーバー）は基本情報で継続使用のため維持
- 影響範囲: 管理画面（/store・/admin 顧客詳細）。残存セクション = 基本情報／身体情報／目標(PFC)／アカウント削除。DB・API・顧客側 UI への影響なし（表示削除のみ）
- 検証: `tsc --noEmit` 0件 / `next build` パス
- 関連: 社長依頼（添付画面の「体重推移〜ツアーリセット」を非表示に）

## 2026-05-31 – feat(admin/store): 目標カロリー・PFC(g)・％ を相互連動＋％を編集可能化
- feat: `app/admin/customers/[id]/page.tsx` 顧客詳細の目標設定で、これまで読み取り専用だった PFC ％を編集可能な入力に変更
- feat: 3者を相互連動。①目標カロリー編集→比率を保持してグラム比例再計算 ②PFC(g)編集→kcal=合計を再計算し％再導出 ③％編集→kcal固定で残り％を他2マクロの現比率に按分しグラム再計算
- 実装: 正本は kcal+grams、％は grams/kcal から導出（編集中フィールドは sync effect で上書きしない）。`pRatio/fRatio/cRatio` の useMemo を撤去し `handleKcalChange/handleGramChange/handlePctChange` に置換
- 影響範囲: 管理画面（/store・/admin 顧客詳細の目標カロリー/PFC 設定）。DB スキーマ・保存ペイロード（goals.kcal/P/F/C）は変更なし
- 関連: 社長要望（カロリー変更で PFC も連動、％でも変更可能に）

## 2026-05-31 – security(P0): テナント分離・トークン混同・管理者IDOR を修正（branch: security/p0-fixes / 未デプロイ）
- security: **トークン purpose 分離**。`lib/adminAuth.ts` セッションに `typ:'session'` を必須化し、`verifySession` は `typ==='session'` のみ受理＋role欠落時の master 推定を廃止（fail-closed）。これにより、同一 `ADMIN_SESSION_SECRET` で署名されるパスワードリセットトークン（email+exp 保持）を `admin_session` Cookie に入れて master 昇格する **CRITICAL 脆弱性**を封鎖。`lib/passwordReset.ts`／`lib/inviteToken.ts` にも `typ`（reset/invite）判別を追加（既存トークンは後方互換で許容＝非破壊）
- security: **クロステナント IDOR 修正（設計#2＝リポジトリ層集約）**。`lib/repository/customers.ts`(patch/archive)・`lib/repository/records.ts`(patch/archive) に `assertCustomerOwnership`／`assertFoodRecordOwnership` を内蔵。`lib/notion.ts` `getCustomerByPageId` に親DB照合を追加し、`getCustomer` 経由の全 admin サブルート（records/weight-history/notifications/analysis 等）のクロステナント読取を一括封鎖
- security: **店舗マスタ**。`lib/stores.ts` `getStore` に tenant_id 自己照合、`updateStore`/`deleteStore` に前段ガード（他テナント店舗の改竄/削除を防止）
- security: **スタッフ**。`app/api/admin/staff/*` を運営(master)専用に限定（DBがテナント横断・tenant_id列なしのため暫定。将来 tenant_id 列追加で店舗別解放）
- security: 管理ルートでクロステナント試行時は 403（`forbidden:`）を返却
- 影響範囲: API（/api/admin/customers・records・stores・staff）／バックエンド lib（認証・リポジトリ・notion・stores）。顧客側UIへの影響なし
- 副作用: **デプロイ時に既存の管理者セッションが全て無効化 → 一度だけ再ログインが必要**（旧トークンに typ が無いため。意図的）。既発行のパスワードリセットリンクも無効化（1h TTL・再発行で対応）
- 注意: 設計上の根本原因（全テナント単一 Notion キー共有／テナントがクライアントヘッダ由来）は別途ロードマップ（per-tenant token・identity→tenant 束縛・Postgres+RLS）で対応予定。本コミットはアプリ層の所有権チェックで封鎖
- 関連: 監査メモ project_security_audit_2026_05_31。顧客側API（LIFFレコード所有者照合・nutrition-label認証・notification read）は staging で別途実装予定

## 2026-05-31 – change(admin/store): 体組成グラフの既定表示を全項目に（チェックを外すと非表示）
- change: `app/admin/analysis/page.tsx` 体組成推移グラフの初期表示を主要3本から**記録のある全項目**に変更。凡例チェックを外すとその項目だけグラフから消える挙動に統一
- 影響範囲: 管理画面（/store・/admin 顧客分析の体組成セクション）

## 2026-05-31 – feat(admin): 顧客リスクラベルを段階表示に拡張＋体重記載漏れ新規追加
- feat: `lib/risk.ts` に `computeWeightRecordGap` 追加（最終体重記録からの日数差計算）
- feat: `lib/repository/customerRisk.ts` 型・upsert・select に `days_since_last_weight` 追加
- feat: `lib/customerRiskService.ts` 体重ログ最新日付から `daysSinceLastWeight` 算出して保存
- feat: `app/api/admin/customers/risk-summary/route.ts` レスポンスに `daysSinceLastWeight` 追加
- feat: `app/admin/progress/page.tsx` 食事記録漏れを3段階（1日=amber/2日=orange/3日以上orNull=rose）、体重記載漏れを同3段階で新規表示、体重停滞を violet に変更
- chore: `lib/db/migrations/004_customer_risk_weight_gap.sql` 追加（CTO が手動実行）
- 影響範囲: 管理画面（/admin・/store 進捗管理のラベル）、API（risk-summary）、DB（customer_risk テーブルにカラム追加要）

## 2026-05-30 – change(admin/store): 記録漏れアラートのしきい値を3日→2日連続に
- change: `lib/risk.ts` `NO_RECORD_THRESHOLD_DAYS` を 3→2 に変更。「今日と昨日の2日連続で食事記録なし（最終記録2日以上前）」で記録漏れと判定。社長フィードバック（2日サボった顧客も早めに検知したい）反映
- 影響範囲: 顧客リスク判定（進捗管理の記録漏れラベル）。本番反映後に cron 再計算で反映

## 2026-05-30 – fix(admin/store): 体組成記録の編集が複製される不具合＋写真AI解析の高負荷エラー対策
- fix: 体組成記録の編集で計測日を変えると別レコードが複製され元データが残っていた不具合を修正。編集時は対象レコードIDで上書き更新するように（`lib/repository/bodyComposition.ts` に `updateBodyCompositionLog` 追加、`app/api/admin/body-composition/route.ts` が `id` 指定時は更新、`app/admin/measurements/page.tsx` が編集時に `id` を送信）
- fix: 写真AI解析の「Gemini API 503 UNAVAILABLE（高負荷）」エラー対策。`analyze/route.ts` に自動リトライ（gemini-2.5-flash×2回→2.0-flash×1回・指数バックオフ）＋一時的高負荷時は「混み合っています。少し待って再試行」の親切な文言を返すように（内部のGeminiエラーJSONを露出しない）
- 影響範囲: 管理画面（/store・/admin 体組成計測記録）・API（body-composition, body-composition/analyze）

## 2026-05-30 – change(admin/store): 体組成推移を体重推移の直下に配置＋既定で畳む
- change: `app/admin/analysis/page.tsx` 顧客分析のセクション順を「体重推移 → 体組成推移 → 運動記録」に変更（従来は体重→運動→体組成）。WeightExercisePanel を展開し体組成を体重の直下へ
- change: 体組成推移セクションを既定で**畳んだ状態**で表示（`bodyCompOpen` 初期値 false）。ヘッダーをタップで展開
- chore: 未使用になった `WeightExercisePanel` を削除
- 影響範囲: 管理画面（/store・/admin 顧客分析）

## 2026-05-30 – change(admin/store): 体組成推移を項目別の個別グラフに戻す（実数値＋ホバー＋全項目）
- change: `app/admin/analysis/page.tsx` 体組成を「初回比%の統合1グラフ」から、**項目ごとの個別ミニグラフのカード一覧**に変更（1つにまとめず、わかりやすさ優先）
- change: 各カードに**実数値の最新値**＋初回からの増減バッジを表示。グラフは実数値の推移で、**マウスホバーで日付＋実数値**をツールチップ表示
- change: 主要3項目に絞らず**記録のある全項目**を表示。折れ線は直線(linear)
- 影響範囲: 管理画面（/store・/admin 顧客分析の体組成セクション）

## 2026-05-30 – change(admin/store): 顧客リスク表示を顧客管理→進捗管理へ移動（ステータス横ラベル）
- change: `app/admin/progress/page.tsx` 進捗管理の各顧客のステータス（進行中等）バッジの横に、リスクラベル（🔴記録漏れ/🟡体重停滞）を表示。`/api/admin/customers/risk-summary` を fetch し pageId で突合（失敗しても本体表示は壊さない graceful）
- change: `app/admin/customers/page.tsx` 顧客管理ページからリスク表示（要注意顧客サマリパネル＋行バッジ＋risk-summary fetch）を削除。未使用化した ChevronUp/ChevronDown import も除去
- 影響範囲: 管理画面（運営/admin・店舗/store の進捗管理・顧客管理）。顧客側 LIFF 変更なし

## 2026-05-30 – change(admin/store): 体組成推移グラフを見やすく（既定3項目＋凡例トグル＋直線）
- change: `app/admin/analysis/page.tsx` 体組成統合グラフを既定で主要3項目（体重・体脂肪率・筋肉量）のみ表示に。線が7本重なって判別しづらかったのを解消
- change: 凡例をタップで各項目の表示/非表示を切替できるように（非表示はグレーアウト）。必要な項目だけ重ねて比較可能
- change: 折れ線を `monotone`(曲線) → `linear`(直線) に変更。少ない計測点で曲線が膨らんで誤解を招くのを防止
- 影響範囲: 管理画面（/store・/admin 顧客分析の体組成セクション）

## 2026-05-30 – change(admin/store): 顧客分析の体組成推移を「初回比%の統合1グラフ」に変更
- change: `app/admin/analysis/page.tsx` 体組成セクションを項目別ミニグラフから、**全項目を初回測定=0%とした変化率で1つの線グラフに統合**（体重60kg/基礎代謝1400kcal/内臓脂肪レベル8 等のスケール差を吸収して一緒に比較可能に）。0%基準線(ReferenceLine)付き
- change: グラフ下に凡例＝各項目の色・最新の絶対値・初回からの増減バッジ（下がると良い項目は色反転）を表示し、絶対値と変化が一目で分かるように
- 影響範囲: 管理画面（/store・/admin 顧客分析の体組成セクション）

## 2026-05-30 – fix(admin/store): 顧客分析の体組成推移が読み込み中に一瞬先行表示されるのを解消
- fix: `app/admin/analysis/page.tsx` 体組成セクションのゲートを `bodyCompFetchedId === customerId` 同一性判定に変更。`!dataLoading` だけでは顧客選択後のデバウンス(300ms)中に dataLoading がまだ false のため一瞬表示されていた。現在の顧客の体組成フェッチ完了まで描画しないことで先行表示/前顧客データのちらつきを根絶。顧客切替時は前データを即クリア＋フェッチに cancel ガード追加
- 影響範囲: 管理画面（/store・/admin 顧客分析の体組成セクション）

## 2026-05-30 – feat(admin): ログイン画面でログイン済みなら自動リダイレクト
- feat: `app/admin/login/page.tsx` マウント時に `/api/admin/auth/me` を確認し、**ログイン済みなら `from`（既定ダッシュボード）へ自動リダイレクト**。確認中は「読み込み中…」表示でフォームのチラつき防止。ログイン済みでログイン画面を開くと再ログインを求められていた問題を解消（/admin・/store 共通）
- 補足: セッション保持は従来通り `admin_session` Cookie 7日間有効（HMAC署名・httpOnly・secure・sameSite=lax）。保持時間・トークン方式は変更なし＝セキュリティリスク増なし
- 影響範囲: 管理画面 /admin/login・/store/login

## 2026-05-30 – change(admin/store): 顧客分析の体組成推移を改善（表示タイミング・全項目・各推移グラフ）
- fix: `app/admin/analysis/page.tsx` 体組成推移セクションの表示ゲートを `!dataLoading` に変更。メイン解析が「データ取得中…」の間に体組成だけ先に出ていたのを、他の結果と一緒に表示されるよう修正
- change: `BodyCompSection` を全登録項目の一覧表示に刷新（体重/体脂肪率/筋肉量に加え 体脂肪量・体水分率・BMI・基礎代謝・内臓脂肪レベル・骨格筋量・部位別筋肉量）。記録のある項目のみカード表示
- change: 各項目を体重推移と同様にミニ折れ線グラフ化し、初回→最新の増減バッジ（下がると良い項目は色反転）で変化が一目で分かるように。`BodyCompLog` 型に全カラムを追加
- 影響範囲: 管理画面（/store・/admin 顧客分析の体組成セクション）

## 2026-05-30 – feat(admin/store): 顧客リスクアラート Phase 1 MVP
- feat: `lib/risk.ts` 純粋関数2種（記録漏れ判定・体重停滞判定）を新規作成
- feat: `lib/db/migrations/003_customer_risk.sql` customer_risk テーブル DDL を追加
- feat: `lib/repository/customerRisk.ts` Neon 接続によるリスクデータの upsert/list/latestComputedAt
- feat: `lib/customerRiskService.ts` テナント文脈内で全顧客のリスク計算→Neon保存するオーケストレーション
- feat: `app/api/cron/compute-customer-risk/route.ts` 全テナントループで risk 計算の cron ハンドラ（vercel.json 追加は Hobby 上限3本のため見送り）
- feat: `app/api/admin/customers/risk-summary/route.ts` withAdminTenant でテナント隔離し Neon からリスク行を返す API（12時間超で waitUntil による裏側再計算）
- feat: `app/admin/customers/page.tsx` 顧客行に記録漏れ（rose）・体重停滞（amber）バッジ追加、上部に要注意顧客折りたたみサマリ
- 影響範囲: 管理画面（/admin・/store 顧客一覧）、API、lib、DB マイグレーション（003）。顧客側 LIFF 変更なし

## 2026-05-30 – feat(admin/store): 体組成DBを保存時に自動プロビジョニング（手動設定不要）
- feat: `app/api/admin/body-composition/route.ts` `ensureBodyCompDbId` を追加し、記録の保存時にテナントの体組成DBが未作成なら自動で作成→レジストリ(`Notion 体組成DB ID`)へ書込→キャッシュ無効化してから保存する（master/店舗どちらでも・冪等）。「Notion 体組成DB ID 未設定」エラーで保存できない問題を解消
- change: `provision-db` アクションも同ヘルパーに統一（手動「体組成DBを作成」ボタンは予備として存置）。未使用の `currentSession` import を削除
- 影響範囲: API（admin/body-composition）・管理画面（/store・/admin 体組成計測記録の保存）

## 2026-05-30 – change/fix(admin/store): 進捗管理を顧客管理の隣へ・体組成 複数写真+拡大表示・写真AI解析のJSONエラー修正
- change: `app/admin/AdminShell.tsx` ナビの「進捗管理」ドロップダウンを「顧客管理」の直後に配置（従来はレポート送付の後ろ）。デスクトップ/モバイル両方。Fragment で顧客管理タブの直後に差し込む形にリファクタ
- feat: `app/admin/measurements/page.tsx` 体組成計測記録の「写真から自動入力(AI)」で複数写真アップロードに対応（`multiple`・蓄積した全枚を1リクエストで統合解析）。サムネイル一覧＋各写真の削除(×)
- feat: 写真サムネイルクリックで拡大ライトボックス表示（全画面オーバーレイ・クリック/×で閉じる）
- fix: `app/api/admin/body-composition/analyze/route.ts` 写真AI解析の「Unterminated string in JSON」エラーを修正。gemini-2.5-flash の thinking を無効化(`thinkingConfig.thinkingBudget:0`)し maxOutputTokens を 2048 に増やして JSON 途中切れを防止。パース失敗時も内部エラーを露出せず親切な文言を返す
- 影響範囲: 管理画面（/store・/admin のナビ・体組成計測記録）・API（body-composition/analyze）

## 2026-05-30 – fix(admin/store): 読み込み中の招待URLコピーを防止（席数情報未取得時の誤コピー対策）
- fix: `app/admin/customers/page.tsx` 顧客一覧の読み込み中（`loading`・`seatInfo` 未取得）は「招待URLをコピー」ボタンを無効化（グレー＋ラベル「読み込み中…」）。従来は読み込み中の一瞬ボタンが有効で、上限到達テナントでも招待URLをコピーできてしまっていた
- 実装: `disabled` と className に `loading` を追加、`copyApplyLink` 冒頭にも `if (loading || seatInfo?.isOverLimit) return` ガード。読み込み後は従来通り（上限時のみ無効。billing API 失敗で seatInfo が null でも fail-open で招待は可能）
- 影響範囲: 管理画面（運営/admin・店舗/store の顧客一覧）。顧客側 LIFF 変更なし

## 2026-05-30 – fix(admin/store): 席数上限ツールチップをボタン下に表示（上端見切れ修正）
- fix: `app/admin/customers/page.tsx` 招待ボタンの上限到達ホバーツールチップを上方向(`bottom-full`/`pb-2`)→下方向(`top-full`/`pt-2`)に変更。ボタンがページ上部にありヘッダーで見切れていたため
- 影響範囲: 管理画面（運営/admin・店舗/store の顧客一覧）。顧客側 LIFF 変更なし

## 2026-05-30 – change(admin/store): 席数上限の警告を常時バナー→招待ボタンのホバーツールチップ化
- change: `app/admin/customers/page.tsx` 顧客一覧の「席数上限到達」警告を、常時表示の赤バナーから「招待URLをコピー」ボタンにマウスホバーした時のツールチップに変更（上限到達時のみ）。内容（利用可能/使用数・上限到達・プランを変更するリンク）は従来バナーと同一。ボタンは従来通り上限時 disabled（コピー不可）
- 実装: ボタンを `relative group` でラップし `group-hover` で表示。`pb-2` でボタンと密着させ、ツールチップ内の「プランを変更する」リンクへマウス移動してもホバーが途切れないように
- 影響範囲: 管理画面（運営/admin・店舗/store の顧客一覧）。残り1席バナーは従来通り常時表示。顧客側 LIFF 変更なし

## 2026-05-30 – feat(admin/store): 体組成計測記録 Phase 2（写真AI解析）・Phase 3（顧客分析体組成セクション）実装
- feat: `app/api/admin/body-composition/analyze/route.ts` 新規作成（POST・`withAdminTenant`・Gemini Vision で体組成計/InBody写真から数値抽出・master/tenant_admin 両方可）
- feat: `app/admin/measurements/page.tsx` に「写真から自動入力（AI）」UIを追加（画像選択→`lib/imageCompress.ts` で圧縮→analyze API呼び出し→フォームprefill・AIバッジ表示）
- feat: `app/admin/analysis/page.tsx`（/store・/admin 共有）に体組成セクションを追加（`BodyCompSection`：体重・体脂肪率・筋肉量の最新値カード＋3指標推移折れ線グラフ・折りたたみ可・記録なし時は「記録がありません」表示・体組成計測記録ページへのリンク）
- change: `app/admin/analysis/page.tsx` に `BodyCompLog` 型・`bodyCompLogs`/`bodyCompOpen` ステート追加。顧客選択時に `GET /api/admin/body-composition?lineUserId=` を自動フェッチ
- 影響範囲: 管理画面（/store・/admin）・API（admin/body-composition/analyze）
- 備考: Drive への元画像保存は未実装（analyze/route.ts に TODO コメントあり）

## 2026-05-30 – feat(admin/store): 体組成計測記録 Phase 1 実装
- feat: `lib/notion.ts` に `createTenantBodyCompDb` 追加・`TenantRow`/`insertTenantRow`/`listTenantRows` に `bodyCompDbId` 列（`Notion 体組成DB ID`）追加
- feat: `lib/tenant.ts` に `notionBodyCompDbId` フィールド追加（env: `NOTION_BODYCOMP_DB_ID`）
- feat: `lib/tenantResolver.ts` に `notionBodyCompDbId` 配線
- feat: `lib/provisionTenant.ts` で新規テナント作成時に体組成DB（4本目）を並列作成
- feat: `lib/repository/bodyComposition.ts` 新規作成（`BodyCompositionLog` 型・CRUD・同一顧客×同日上書き）
- feat: `app/api/admin/body-composition/route.ts` 新規作成（GET/POST/DELETE + provision-db アクション）
- feat: `app/admin/measurements/page.tsx` 新規作成（体組成計測記録ページ・顧客選択・フォーム・履歴テーブル・詳細モーダル）
- feat: `app/store/measurements/page.tsx` 新規作成（admin 側を re-export）
- change: `app/admin/AdminShell.tsx` 進捗管理をドロップダウン化（配下: 進捗管理/食事一覧/体組成計測記録）・食事一覧をナビに正式追加・openMenu state を 'progress'|'settings'|null に一般化
- 影響範囲: 管理画面（/store・/admin）・lib（テナントプロビジョニング）

## 2026-05-29 – change(admin): 顧客管理ヘッダーを「進行中/全顧客数」表記に
- change: `app/admin/customers/page.tsx` ヘッダーを `顧客管理（進行中数/全顧客数名）` に変更（例 8/10名）。従来は `実顧客数/契約席数`(=10/8) で分子分母の意味が逆だった。契約席数とは別軸で、アクティブ会員が全体の何名かを表示
- 影響範囲: 管理画面（/store・/admin 顧客管理ヘッダー）

## 2026-05-29 – change(admin): タブ改称（契約→契約管理・店舗→店舗一覧）
- change: `app/admin/AdminShell.tsx` タブラベル「契約」→「契約管理」、「店舗」→「店舗一覧」
- change: `app/admin/stores/page.tsx` ページタイトル「店舗管理（X件）」→「店舗一覧（X件）」（タブと統一）
- 影響範囲: 管理画面（/store・/admin ナビ）

## 2026-05-29 – change(admin): 顧客設定→顧客管理に改称・全メニューの横ズレ修正
- change: 「顧客設定」→「顧客管理」に改称（`app/admin/AdminShell.tsx` タブ・`app/admin/customers/page.tsx` ヘッダー）。ヘッダーは契約席数があれば `顧客管理（実顧客数/契約席数名）`、未設定なら `顧客管理（X名）`
- fix: `app/globals.css` html に `scrollbar-gutter: stable` を追加。ページ内容の高さでスクロールバーが出る/出ないにより中央寄せ(`max-w-5xl mx-auto`)が左右にズレていたのを全ページで統一
- 影響範囲: 管理画面（/store・/admin の全ページ共通ヘッダー/幅）

## 2026-05-29 – change(admin/store): ナビに「設定」ドロップダウンを追加・関連メニューを集約
- change: `app/admin/AdminShell.tsx`（/store・/admin 共有のヘッダーナビ）
  - トップタブを「顧客管理 / 進捗管理 / 顧客分析 / レポート送付」に絞り、それ以外を「設定」ドロップダウン配下に集約（クリックで展開、PCは下向きパネル・モバイルはメニュー内の「設定」セクション）
  - store の設定配下: LINE連携設定 / 契約 / テンプレ管理 / 店舗（表示順）
  - admin の設定配下: テンプレ管理 / テナント / プラン管理 / 監査ログ（master のみ）
  - rename: store「セットアップ」→「LINE連携設定」（`/onboarding` のラベルのみ変更、パスは不変）
  - 設定配下のいずれかがアクティブな時は「設定」タブをアクティブ表示。デスクトップナビの overflow をドロップダウンが隠れないよう visible に変更
- 影響範囲: 管理画面（/store・/admin のヘッダーナビ）

## 2026-05-29 – change(admin): 顧客設定ヘッダーに契約席数を併記・進捗管理ヘッダーの件数を削除
- change: `app/admin/customers/page.tsx` ヘッダーを `顧客設定（実顧客数/契約席数名）` 形式に（`seatInfo.seatLimit` がある場合。無制限プラン等で null のときは従来の `（X名）`）
- change: `app/admin/progress/page.tsx` ヘッダーを `進捗管理（X名）` → `進捗管理`（件数表記を削除。本文のフィルタ結果件数表示は存置）
- 影響範囲: 管理画面（/store・/admin の顧客設定・進捗管理ヘッダー）

## 2026-05-29 – change(admin/store): 顧客一覧の表示改善（LINE連携バッジ移動・進行中の色・目標PFC表示）
- change: `app/admin/customers/page.tsx`（/admin・/store 共有の顧客一覧）
  - 「LINE 連携済み」バッジを名前行のステータス（進行中等）の隣に移動。従来の下段の別行バッジは削除し、下段は承認ボタンがある時だけ表示
  - ステータスバッジの色を整理：進行中=orange、休止中=sky(青)、卒業=stone(グレー)（承認待ち=yellow、LINE連携済み=emerald と全て別色に。隣接時の判別性向上）
  - 目標PFC（P/F/C グラム）を「目標kcal/日」の横（同じ行）に inline 表示（`… ・ 目標 ○kcal/日 ・ 目標PFC P○・F○・C○g`。目標kcal>0 のとき）。行が伸びるため当該行の truncate を解除し折り返し可に
- 影響範囲: 管理画面（運営/admin・店舗/store の顧客一覧）。顧客側 LIFF 変更なし
- change: `app/admin/AdminShell.tsx` ヘッダー左上に FitMeal ロゴ(アイコン+ワードマーク `/fitmeal-icon.png` `/fitmeal-wordmark.png`)を表示。クリックで `${base}/progress`(進捗管理)へ遷移。ページタイトルはロゴの右に区切り線付きで配置。従来の Building2/Users アイコンは置き換え
- add: `public/fitmeal-icon.png` `public/fitmeal-wordmark.png`(LP fitmeal.jp と同一アセットをコピー)
- 影響範囲: 管理画面（/store・/admin 全ページの共通ヘッダー AdminShell）。顧客LIFFは対象外

## 2026-05-29 – change(store): お知らせ送信を運営(/admin)専用化・店舗(/store)はレポートのみ
- change: `app/admin/reports/page.tsx` 店舗(/store)では [レポート/お知らせ] トグルを非表示にしレポートモード固定（`?mode=announcement` 直叩きも report に強制）。お知らせ送信モードは運営(/admin)のみ表示
- change: `app/api/admin/announcements/route.ts` POST を運営(master)専用に。非master(店舗)からの作成は 403（サーバ側強制）。従来は店舗も自テナント宛で送信可だった
- 維持: 運営→店舗のお知らせ受信(/store/announcements・ベル)は従来通り継続。店舗から顧客への「送信」のみ撤去
- 影響範囲: 管理画面（/store レポート送付からお知らせ送信導線が消える）・API
- 背景: 店舗と運営が同一お知らせDBを参照し同期されて紛らわしいため、送信は運営に一本化。将来テナント店舗の送信が必要になれば再開可

## 2026-05-29 – fix(store): お知らせ削除ボタンが運営の全テナント一斉お知らせで非表示になる不具合
- fix: `app/admin/reports/page.tsx` `AnnouncementRow` の削除ボタン表示条件を `!isStore || targetTenants.length>0` → `isMaster || targetTenants.length>0` に変更。運営(master)が /store から送った全テナント一斉(対象テナント空)のお知らせで削除ボタンが出なかった問題を修正（API側はmaster全件削除可なのにUIだけ隠れていた）
- 影響範囲: 管理画面（/store・/admin レポート送付 送信履歴）

## 2026-05-29 – fix(infra): 運動DBを staging/本番で分離
- 事象: `NOTION_EXERCISE_DB_ID` が Production/Preview 共通の単一レコード＝staging と本番が同じ運動DB(`36e7034a…`)を共有していた（お知らせDBに続く未分離の残り1件）
- 対処: staging 専用運動DB `運動記録 (staging)` (`36fa47a8…b5d3`) をアプリ連携トークンで新規作成し、Vercel Preview(staging) に branch 上書き env を追加。本番(Production)の値は無変更
- 影響範囲: staging のみ（本番ゼロ変更）。これで全 Notion DB が staging/本番で分離完了
- 補足: 運動記録は lineUserId フィルタのため broadcast 漏れは元々無いが、テスト顧客のLINE ID重複時の混線リスクを排除

## 2026-05-29 – feat(audit): 監査ログ Phase 1 残タスク3点（env分離・閲覧UI・LIFF記録拡張）
- add: `lib/db/migrations/002_audit_log_env.sql` — audit_log に env カラム追加＋複合インデックス（staging/本番分離用）
- change: `scripts/migrate-audit-log.mjs` — lib/db/migrations/*.sql をファイル名昇順で全適用する汎用スクリプトに変更（冪等・001も002も再実行安全）
- change: `lib/auditLog.ts` — INSERT に env カラム追加。値は VERCEL_TARGET_ENV || VERCEL_ENV || 'development'
- add: `lib/repository/auditLog.ts` — Neon から audit_log を読む `listAuditLogs(filter)` / `isDbConnected()`（パラメータ化クエリ、DB未設定時は空配列返却）
- add: `app/api/admin/audit-logs/route.ts` — `withMasterOnly` ラップのGET API（action/outcome/env/from/to/limit フィルタ）
- fix: `audit-logs` API の limit を `Math.max(1, Math.min(Number||100, 500))` に堅牢化（負数/NaN で 500 になる QA 指摘の修正）
- add: `app/admin/audit/page.tsx` — master 専用監査ログ閲覧ページ。failure を赤強調、DB未接続時は案内メッセージ表示
- change: `app/admin/AdminShell.tsx` — 「監査ログ」タブを masterOnly/storeHidden で追加（ShieldCheck アイコン）
- change: `app/api/record/route.ts` — 保存成功後に meal.create をログ（actorId=lineUserId, tenantId, targetId=notionPageId）
- change: `app/api/record/update/route.ts` — 更新成功後に meal.update をログ
- change: `app/api/delete/route.ts` — 削除成功後に meal.delete をログ
- change: `app/api/customer/me/route.ts` — PATCH 成功後に profile.update をログ（metadata.fields に変更フィールド名のみ）
- 影響範囲: DB（002マイグレーション要実行）/ 管理画面（master のみ新タブ）/ API サーバー側ログ追加。顧客側レスポンス・挙動変更なし

## 2026-05-29 – fix(security): 監査ログ マイグレーションスクリプトを Neon ドライバ対応に修正
- fix: `scripts/migrate-audit-log.mjs` — Neon HTTP ドライバは `sql(string)` 形式・複数文一括実行を受け付けないため、SQL を `;` で分割し `sql.query()` で 1 文ずつ実行する形に修正。本番 Neon に対し実行し audit_log テーブル＋3インデックスを作成済み（テストINSERT/DELETEで動作確認、現行行数0）
- chore: `.gitignore` に `.env*.local` を追加（Neon 連携が生成する接続文字列ファイルの誤コミット防止）
- 影響範囲: DB（audit_log テーブル作成）/ 開発スクリプトのみ。アプリ挙動・顧客側変更なし

## 2026-05-29 – fix(customer/store): 所属店舗の店舗ID(gotanda)生表示を店舗名に統一＋契約タブをstore限定
- fix(customer): `app/profile/page.tsx` 顧客プロフィールの「所属店舗」が storeId（gotanda）を生表示していたのを店舗名（メヲダス五反田店）に修正。`/api/customer/me` で `getStoreByStoreId()` により storeName を解決して返す（失敗時 null→UIで storeId にフォールバック）
- change(store): `app/admin/AdminShell.tsx` 「契約(/billing)」タブに storeOnly を付与。運営(master/admin)文脈では非表示、店舗(/store)でのみ表示
- 影響範囲: 顧客側 LIFF（プロフィール）/ 管理画面ナビ。※ staging 検証必須

## 2026-05-29 – feat(security): Phase 1 監査ログ Neon Postgres 永続化
- add: `@neondatabase/serverless` ^1.1.0 を依存に追加（Neon HTTP serverless ドライバ）
- add: `lib/db/migrations/001_audit_log.sql` — audit_log テーブル DDL（IF NOT EXISTS 冪等）、ts/tenant_id/action の3インデックス
- add: `scripts/migrate-audit-log.mjs` — Neon へ 001_audit_log.sql を適用する単独スクリプト（DATABASE_URL 未設定時は即終了）
- change: `lib/auditLog.ts` — Phase 0 の console.log/Sentry 挙動を維持したまま、`DATABASE_URL`/`POSTGRES_URL`/`POSTGRES_PRISMA_URL` が存在する場合に `audit_log` へ INSERT を追加。DB 書き込みは `waitUntil()` でレスポンス後 flush、env 未設定時は完全 no-op、INSERT 失敗は console.error 1行で握りつぶし。`AuditEvent` に `ip?`/`userAgent?` フィールドを追加
- change: `app/api/admin/auth/login/route.ts` — `x-forwarded-for` と `user-agent` を取得し auth.login イベントに ip/userAgent を付与
- 影響範囲: API（サーバー側ログのみ。顧客側 LIFF・既存 API レスポンス変更なし）
- graceful 設計: `sql` は起動時に env が無ければ `null`。`insertAuditRow`/`logAuditEvent` いずれも `if (!sql)` で早期リターン。DB 例外は `.catch()` で握りつぶし。`waitUntil` 例外は `try/catch` でフォールバック

## 2026-05-29 – feat(store): お知らせの削除機能を追加（アーカイブボタン未実装の修正）
- feat: `/store/reports`・`/admin/reports` のお知らせ送信履歴で、各お知らせを展開→「削除」ボタンで削除可能に（confirm付き）。従来はボタン自体が未描画で操作不能だった
- feat: `lib/announcements.ts` に `deleteAnnouncement`（Notionページをゴミ箱へ移動＝送信履歴・顧客表示の両方から消える。Notionゴミ箱で30日復元可）、`app/api/admin/announcements` に `DELETE` ハンドラを追加（店舗=自テナント宛のみ削除可・運営=全件、権限はサーバ強制）
- 影響範囲: 管理画面(/store・/admin reports)・API(/api/admin/announcements)・顧客表示（削除されたお知らせは /announcements からも消える）

## 2026-05-29 – fix(store): 顧客分析の店舗チップが店舗ID（gotanda）を表示する不具合
- fix: `app/admin/analysis/page.tsx` 店舗フィルタのラベルを storeId そのままから表示名（メヲダス五反田店 等）に修正。`/api/admin/stores` を取得し storeId→name マップでラベル解決（進捗管理と同方式）。未登録店舗は storeId をフォールバック表示
- 影響範囲: 管理画面（/store・/admin の顧客分析 店舗フィルタ）

## 2026-05-29 – feat(security): Phase 0 監査ログ実装
- add: `lib/auditLog.ts` — `logAuditEvent()` 新規作成。console.log(JSON) + Sentry breadcrumb。ログイン失敗時は captureMessage も発火。fire-and-forget (try/catch 握りつぶし)
- instrument: `app/api/admin/auth/login/route.ts` — master/tenant_admin ログイン成功・失敗を記録
- instrument: `app/api/admin/auth/change-password/route.ts` — パスワード変更成功・失敗を記録
- instrument: `app/api/admin/customers/[id]/route.ts` (DELETE) — 顧客アーカイブを記録
- instrument: `app/api/stripe/update-seats/route.ts` — 席数/プラン変更成功を記録
- instrument: `app/api/admin/invites/create/route.ts` — 招待トークン発行を記録
- 影響範囲: API（サーバー側ログのみ。顧客側 LIFF UI 変更なし）

## 2026-05-29 – fix(infra): お知らせDBを staging/本番で分離（データ漏れ修正）
- 事象: staging と本番が同一の `NOTION_ANNOUNCEMENTS_DB_ID`(ae40c5c3…755d) を共有していたため、staging で作成した顧客向けテストお知らせ（対象テナント＝空＝全配信）が本番顧客の /announcements に表示されていた
- 対処1: staging 専用お知らせDB(36fa47a8…f98)を新規作成（アプリ連携「メヲダス_GAS連携」所有で作成・アクセス確認済）、Vercel Preview(staging) の `NOTION_ANNOUNCEMENTS_DB_ID` を差し替え。本番(Production)の値は変更なし
- 対処2: 共有DBのテストお知らせ全6件を「アーカイブ」化（本番顧客向け漏れ1件・本番/store管理画面に出ていた店舗向け3件・staging限定/下書き2件）
- 影響範囲: 顧客側LIFF(/announcements 表示)・本番/store・staging
- 補足: 通知DB(NOTIFICATIONS)は元から staging/本番で別ID。今回お知らせ(ANNOUNCEMENTS)のみ未分離だった

## 2026-05-29 – change(store): 顧客分析の運動 種目別集計（重複）を削除
- change: `app/admin/analysis/page.tsx` 「計N回」下の種目別集計（日付なし・1行記録リストと内容重複）を撤去。集計ロジック・未使用 isSingleDay も整理
- 影響範囲: 管理画面（/store・/admin の顧客分析 運動記録）

## 2026-05-29 – change(store): 顧客分析の運動記録を1行表示（日付込み・時間削除）
- change: `app/admin/analysis/page.tsx` 運動記録リストを「1記録=1行（日付＋種目を同一行）」のフラット表示に。日別グループ見出し・カード枠・「時間: —」表示・ExerciseRow を撤去（種目別集計バナーは存置）
- 影響範囲: 管理画面（/store・/admin の顧客分析 運動記録）

## 2026-05-29 – change(liff): 週次分析ページのヘッダーに説明文を追加
- change: `app/weekly/page.tsx` PageHeader に subtitle「直近7日間の食事・体重の振り返り」を追加（タイトルのみで説明文がなかったため）
- 影響範囲: 顧客側 LIFF（/weekly）

## 2026-05-29 – fix(admin): 顧客分析に個人シート系の運動記録を統合
- fix: `app/api/admin/customers/[id]/analysis/data/route.ts` — `getRangeExtras` で個人シート運動を取得し、運動DB(listExerciseLogsByLineUser)と重複排除マージ。同一日付は運動DB優先
- fix: `app/admin/analysis/page.tsx` ExerciseSection/ExerciseRow — durationMin/estimatedKcal が 0（シート由来）のエントリを「時間: —」で表示。サマリは実数値のみ加算
- 影響範囲: 管理画面 /admin/analysis、/store/analysis（顧客側 UI 変更なし）

## 2026-05-29 – change(liff): メニュー名称変更（週次分析・体重記録）
- change: `app/menu/page.tsx` メニューラベルを「週次レポート」→「週次分析」、「体重推移・予測」→「体重記録」(sub「過去記録とAI予測」)
- change: `app/weekly/page.tsx` ページタイトル「週次レポート」→「週次分析」
- change: `app/prediction/page.tsx` ページタイトル「体重推移・AI予測」→「体重記録」、subtitle「過去記録とAI予測」（記録閲覧＋AI予測の両方が見られる旨を明確化）
- 影響範囲: 顧客側 LIFF（/menu /weekly /prediction）
- 備考: 通知カテゴリ「週次レポート」(Notion select値・データ契約) は据え置き

## 2026-05-29 – change(store): 進捗 体重の前日比文字サイズも他に合わせ拡大
- change: `app/admin/progress/page.tsx` WeightDelta（前日比・+0.2kg 等）を text-xs に拡大し他の文字サイズに統一
- 影響範囲: 管理画面（/store・/admin の進捗管理 一覧UI）

## 2026-05-29 – change(store): 進捗カードの文字サイズ拡大（ラベル/PFC/体重値）
- change: `app/admin/progress/page.tsx` 「食事」「体重」ラベルと PFC チップを text-xs に、体重の数値を text-lg に拡大（視認性向上）
- 影響範囲: 管理画面（/store・/admin の進捗管理 一覧UI）

## 2026-05-29 – change(store): 顧客分析の運動を体重の下に表示（常に縦積み）
- change: `app/admin/analysis/page.tsx` WeightExercisePanel を常に縦積み（体重→運動）に。単日時の横2カラム分岐を撤去し、運動を必ず体重の下に表示
- 影響範囲: 管理画面（/store・/admin の顧客分析）

## 2026-05-29 – change(store): 進捗カードの文字/PFC表記・矢印位置・更新ボタン・プルダウン整合
- change: `app/admin/progress/page.tsx` 食事カードの「/目標kcal」「達成%」を text-sm に拡大。PFCを「実測 / 目標g」表記に（`app/api/admin/progress/route.ts` で目標P/F/Cを返すよう追加）
- change: 右矢印をカード（食事・体重）の中央高さに揃うよう行構造を変更（氏名を上段→カード行+矢印を items-center の同一行に）
- change: 「N名」右の更新ボタンを削除（未使用 RefreshCw import も除去）
- fix: 顧客プルダウンをステータス絞り込みにも連動（プルダウンに出るのに選ぶと0件になる不整合を解消）
- 影響範囲: 管理画面（/store・/admin の進捗管理 一覧UI・API）

## 2026-05-29 – change(store): 進捗カードを食事4/5＋体重1/5の横並びに・運動カード削除
- change: `app/admin/progress/page.tsx` 進捗一覧の顧客カードを「食事(4/5幅・kcal/%・バー・PFC)＋体重(1/5幅)」の横並び1段に。運動カード(ExerciseCard)を削除。食事カードの内部レイアウトは現状維持
- 影響範囲: 管理画面（/store・/admin の進捗管理 一覧UI）

## 2026-05-29 – change(store): 定期レポート設定・レポートのLINE送付UIを一時非表示（機能は存置）
- change: `app/admin/AdminShell.tsx` ナビから「定期レポート設定」(/scheduled-reports) タブを削除（ページ・cron・lib は存置＝直URLでは到達可）。未使用 CalendarClock import も除去
- change: `app/admin/reports/page.tsx` レポート送付の「顧客の LINE にも送信」チェックボックスを非表示（`{false &&}`）＋既定を sendLinePush=false に（アプリ内保存のみ）。LINEプッシュ機能自体は存置
- 影響範囲: 管理画面（/store・/admin のナビ・レポート送付）

## 2026-05-29 – fix(cron): daily-reports を日次スケジュールに修正（全デプロイ失敗を解消）
- fix: `vercel.json` の `/api/cron/daily-reports` を `0 * * * *`(毎時)→`0 21 * * *`(UTC21時=JST06:00・日次)に変更。Hobbyプランは「cronは1日1回まで」のため毎時cronで**全デプロイが失敗**していたのを解消（staging/本番とも約1h停止していた）
- 注意: daily-reports ルートは送信時刻の"時"一致で発火する設計。日次cronはデフォルト送信時刻 `06:00` に合わせたため、06:00設定のテナントのみ自動送信される（毎時送信＝顧客別時刻にはPro必要）。現状 lineAutoSendEnabled は opt-in で全OFFのため実送信影響なし
- 影響範囲: デプロイ基盤（cron）/ 前日レポート自動送信のスケジュール

## 2026-05-29 – feat(scheduled-reports): 定期レポート送信管理機能を実装
- feat(lib): `lib/scheduledReports.ts` 新規追加。`SCHEDULED_REPORTS_DB_ID` を使った定期配信ルール CRUD（listRulesForTenant / listAllRules / createRule / updateRule / deleteRule）。全テナント共有DB・tenant_id列で分離。1分キャッシュ。
- feat(api): `app/api/admin/scheduled-reports/route.ts` 新規追加（GET・POST）。GET は master=全件、非 master=自テナントのみ。POST はテナント強制（非 master は getCurrentTenant().id 固定）・入力バリデーション付き。
- feat(api): `app/api/admin/scheduled-reports/[id]/route.ts` 新規追加（PATCH・DELETE）。他テナントのルール操作を 403 で拒否。
- feat(ui): `app/admin/scheduled-reports/page.tsx` 新規追加。ルール一覧（有効トグル・編集・削除）＋作成/編集フォームモーダル。master のみ対象テナント選択表示。store は自テナント固定。
- feat(ui): `app/store/scheduled-reports/page.tsx` 新規追加（admin ページの 1行 re-export）。
- feat(ui): `app/admin/AdminShell.tsx` に「定期レポート設定」タブ追加（CalendarClock アイコン・masterOnly なし）。
- feat(cron): `app/api/cron/daily-reports/route.ts` を定期配信ルール走査方式に全面置換。listAllRules() → shouldFire() で発火判定（毎日/毎週(曜日)/毎月(末日フォールバック)）→ テナント設定取得 → 顧客絞り（全顧客/店舗）→ テンプレ名一致解決 → アプリ内保存・LINE送信をルールに従い制御。autoSendTime/lineAutoSendEnabled への依存を廃止。
- change(ui): `app/admin/tenants/[id]/page.tsx` の autoSendTime フィールドに「※自動配信は「定期レポート設定」で管理（このフィールドは旧設定）」の注記を追加。
- fix(cron): Hobbyプランのcronは日次1回(`0 21 * * *`=朝6時JST)のため、shouldFire から「時刻の時一致」判定を除去し「配信日(毎日/毎週曜日/毎月日)」のみで発火する方式に変更。時刻フィールドは保持するが当面は毎朝まとめて配信（時刻指定はPro移行で毎時化した際に有効化）。scheduled-reports UI の時刻入力に注記を追加。
- fix(lib): `listAllRules()` の「有効=true」Notionフィルタを除去し全件返すよう修正（QA指摘: master の一覧で無効ルールが消えて編集/削除できない不具合）。cron は呼び出し後 `r.enabled && shouldFire` でフィルタ済みのため発火対象は有効ルールのみで動作不変。
- 影響範囲: 管理画面（/admin・/store の定期レポート設定・テナント設定注記）/ API（/api/admin/scheduled-reports）/ Cron（daily-reports 置換）/ lib（scheduledReports.ts 新規）

## 2026-05-29 – change(demo): 読み取り専用の文言調整
- change: `lib/withTenant.ts` デモ/プレビューの書き込み拒否(403)メッセージを `demo is read-only` → `読み取り専用です。` に変更（画像アップ等で出る文言を日本語化）
- change: `app/admin/customers/page.tsx` プレビューモーダルのヘッダを「読み取り専用（60分）」→「読み取り専用」に（60分表記を削除）
- 影響範囲: 管理画面（顧客プレビュー）・API（withLiffTenant のデモ403文言）

## 2026-05-29 – improve(reports): 送信ボタンのチェックボックス化 + アドバイス質向上
- change(admin): `app/admin/reports/page.tsx` の送信セクションを2チェックボックス（FitMealアプリ内保存・LINE送信）＋ボタン1つに変更。hidden の `sendLine()` を統合・削除。両方OFFでボタンdisabled。
- change(api): `app/api/admin/notifications/route.ts` に `saveInApp` フラグ（既定 true）を追加。`saveInApp===false` 時は createNotification をスキップし pushLineMessage のみ実行。両方 false は 400 エラー。返却形式 `{ notification, push }` 維持（保存しない場合 notification は null）。
- improve(lib): `lib/gemini.ts` の `generateReportComments` に `mealItems: Array<{mealType, name}>` パラメータを追加。プロンプトを食事区分別（朝食/昼食/夕食/間食）に整形して提示し、実際の料理名引用・具体的次の一手を求めるよう改訂。ai_advice を2〜3文に。食事記録なし時は記録促進コメントに誘導。
- improve(api): `app/api/admin/reports/generate/route.ts` と `app/api/cron/daily-reports/route.ts` で records から mealItems を構築し generateReportComments に渡すよう変更。
- 影響範囲: 管理画面（/admin/reports・/store/reports）/ API（/api/admin/notifications）/ lib（gemini.ts）/ Cron

## 2026-05-29 – feat(cron): 前日レポート自動配信(daily-reports)を有効化
- feat: `vercel.json` の crons に `/api/cron/daily-reports`（schedule `0 * * * *`＝毎時0分）を追加。各テナントの「自動送付時刻」の時とJST現在時が一致したテナントだけ発火。
- 注意: 発火条件は テナントの「LINE自動送付=ON」AND「LINE Channel Token 有」AND 契約状態≠解約 AND 顧客/食事DB有。現状全テナント「LINE自動送付=False」のため、ONにするまで誰にも送信されない（opt-in）。対象顧客は foodStatus='進行中' かつ LINE ID 有のみ。
- 影響範囲: API/Cron（本番のみcron登録。Preview では実行されない）

## 2026-05-29 – change(store): 進捗の件数からデモ顧客を除外
- change: `app/admin/progress/page.tsx` 進捗管理の件数表記（タイトル・一覧上部）から SAMPLE_/DEMO_ のデモ顧客を除外（一覧表示は維持）。席数/請求カウント(lib/seats.ts)・顧客設定の件数は既に除外済みで、進捗の表記のみ漏れていたのを統一
- 影響範囲: 管理画面（/store・/admin の進捗管理 件数表記）

## 2026-05-29 – fix(announcements): お知らせ送信日時(createdAt)追加・Invalid Date 修正
- fix: `lib/announcements.ts` の `Announcement` 型に `createdAt: string`（Notion page.created_time）を追加。`pageToAnnouncement` が `created_time` を受け取りセット。全取得関数の result 型に `created_time` を追加。
- fix: `listAnnouncementsForTenant` / `listAnnouncementsForStore` のソートを `publishedAt` 基準から `createdAt` 降順に変更（pinned 先頭は維持）。Notion query sort も `created_time` タイムスタンプ降順に統一。
- fix: `app/notifications/page.tsx` の `formatDate` に Invalid Date 防御を追加（空文字なら `''`、`isNaN` なら `''`）。お知らせの `createdAt` を `a.createdAt || a.publishedAt || ''` で優先参照。
- fix: `app/store/announcements/page.tsx` の Announcement 型に `createdAt` 追加。`formatDate` に Invalid Date 防御追加。日時表示を `publishedAt` → `createdAt` に変更。
- fix: `app/admin/reports/page.tsx` の Announcement 型に `createdAt` 追加。`formatAnnDate` 関数（防御版）を追加。送信履歴 `AnnouncementRow` の日時表示を `publishedAt` → `formatAnnDate(a.createdAt)` に変更。
- 影響範囲: 顧客LIFF（/notifications）/ 管理画面（/store/announcements・/admin/reports・/store/reports）/ lib

## 2026-05-29 – chore: 本番 mewodas に山田花子(DEMO_FITMEAL_SAMPLE)シード完了・一時ファイル削除
- chore: Notion MCP で本番 mewodas テナントに顧客1件・食事25件・体重9件・個人シート1件を直接投入。シード完了確認済み。
- chore: `app/api/admin/seed-demo/route.ts`（一時エンドポイント）を削除。`SEED_DEMO_TOKEN` を production env から削除済み。
- 影響範囲: Notion データのみ（コード変更なし）

## 2026-05-29 – fix(store): 受信inbox/ベルを「店舗向け」お知らせのみに絞る
- fix: `app/store/announcements/page.tsx`・`lib/useStoreAnnouncementUnread.ts` で取得結果を `audience==='店舗向け'` でフィルタ。店舗が送った顧客向け一斉お知らせが自店舗の受信ベルにも出てしまう不具合(QA BUG-1)を修正。
- 影響範囲: 管理画面（/store/announcements・店舗ヘッダーベル）

## 2026-05-29 – change(store): 進捗カードに運動を復活・体重は最新値表示を維持
- change: `app/admin/progress/page.tsx` 進捗の顧客行を「食事（全幅・PFC内訳）＋ 体重・運動（2列）」レイアウトに。運動カード（ExerciseCard・当日の分数/件数）を復活
- note: 体重は従来どおり最新エントリの値を表示（当日基準への変更は行わない＝社長要望「いままでの内容に戻して」）
- 影響範囲: 管理画面（/store・/admin の進捗管理）

## 2026-05-29 – feat(announcement): お知らせ統合 — reports トグル復活・顧客受信再マージ・バッジ合算
- feat: `app/admin/reports/page.tsx` に [レポート/お知らせ] トグルを復活（5403842 の設計を現行 reports に統合）。店舗モードは「自店舗の全顧客に一斉送信」案内のみ、master モードは宛先種別（顧客向け/店舗向け）＋対象店舗（全/特定）を選択可。送信履歴も表示。
- feat: `app/admin/announcements/page.tsx` を `${base}/reports?mode=announcement` への router.replace redirect に変更（送信機能は reports に移管）。
- feat: `app/admin/AdminShell.tsx` から masterOnly の `/announcements`「店舗へのお知らせ」タブエントリを削除。ヘッダーベル（/store/announcements 受信 inbox）は維持。
- feat: `app/api/admin/announcements/route.ts` の POST を店舗送信可に変更（非 master は audience='顧客向け' 強制・targetTenants=[自テナント] 固定）。GET の audience='店舗向け' ハードフィルタを解除（master=全件、非 master=自テナント宛 or 全体）。
- feat: `app/notifications/page.tsx` に /api/announcements 取得を再マージ。顧客向けお知らせを「お知らせ」タブ＆すべてに表示。既読は localStorage（customerスコープ）。タブ配列・subtitle・PageHeader title は現行維持。
- feat: `lib/announcementReads.ts` を scope 引数対応に（customer→`fitmeal_read_announcements`、store→`fitmeal_store_read_announcements`）。デフォルト='store' で既存呼び出し互換を維持。
- feat: `app/store/announcements/page.tsx`・`lib/useStoreAnnouncementUnread.ts` の読み書きを scope='store' に明示更新。
- feat: `lib/useInboxUnread.ts` 新規。個別通知＋顧客向けお知らせ（customerスコープ）の合算未読数フック。`app/home/_components/LiffGate.tsx`・`app/menu/page.tsx` で `useNotificationsUnread` を置き換え。
- 影響範囲: 顧客LIFF（/notifications・ホームベル・/menu バッジ）、管理画面（/admin/reports・/store/reports・/admin/announcements redirect）、API（POST/GET 変更）

## 2026-05-29 – feat(cron): デモ顧客記録の日次リフレッシュ cron 追加
- feat: `lib/refreshDemoData.ts` 新規。SAMPLE_/DEMO_ プレフィックス顧客の食事・体重・個人シートを今日基準で再生成（既存レコードを archived:true 後に直近7日分を再投入）
- feat: `app/api/cron/refresh-demo-data/route.ts` 新規。全テナント走査・checkCronAuth 認証（Bearer CRON_SECRET）
- feat: `vercel.json` に cron 追加（毎日 19:00 UTC = JST 04:00）
- 影響範囲: cron / API（顧客側UI・管理画面の動作変化なし）

## 2026-05-29 – change(customer): レポート受信箱のタブ「週次」→「週次レポート」に改名
- change: `app/notifications/page.tsx` のタブラベル「週次」を「週次レポート」に統一（メニュー表記と一致）。matchTab も追随。挙動・カテゴリ判定は不変。
- 影響範囲: 顧客側LIFF（/notifications）

## 2026-05-29 – fix(demo): プレビューiframe内ではデモバナーを出さない
- fix: `lib/demoClient.ts` に `isPreviewMode()`（preview_token/sessionStorage 由来=プレビュー）を追加。`components/DemoBannerWrapper.tsx` で公開 /demo（localStorage 由来）のみバナー表示し、ストアの顧客画面プレビューiframe では非表示に（モーダルで読み取り専用を明示済みのため重複回避）
- 影響範囲: 顧客LIFF（デモバナー表示条件）

## 2026-05-29 – change(store): 進捗カード3行化・承認待ち削除・店舗チップ即時表示
- change: `app/admin/progress/page.tsx` 食事カードを3行構成に圧縮（食事ラベルの横にkcal・%、食数を上段右へ、行間を詰める）。体重カードも詰めてラベル横に値表示
- change: 進捗・顧客設定のステータス絞り込みから「承認待ち」を削除（`app/admin/progress/page.tsx`・`app/admin/customers/page.tsx`）
- change: 進捗・顧客分析の店舗チップを読み込み前から常時表示（ロード完了まで出ない問題を解消）
- change: `app/admin/analysis/page.tsx` 店舗フィルタから「店舗未設定」を除外
- 影響範囲: 管理画面（/store・/admin の進捗管理・顧客設定・顧客分析）

## 2026-05-28 – change(store): 顧客分析のフィルタを進捗管理と同じ構成に統一
- change: `app/admin/analysis/page.tsx` 店舗フィルタを `<select>`→チップ化し、期間→店舗チップ→顧客select の1カード構成に（進捗管理と同じ見た目）。顧客分析は単一顧客選択のためステータス絞り込みは付けない
- 影響範囲: 管理画面（/store・/admin の顧客分析フィルタ）

## 2026-05-28 – change(customer): 顧客側「お知らせ」表記を「レポート」に変更
- change: 顧客LIFFの受信機能名を「お知らせ」→「レポート」に統一（/notifications タイトル・空表示・準備中文言、/menu 項目ラベル、ホームベルの aria-label）。アイコンはベルのまま、subtitle「トレーナーからの連絡」維持。
- 据え置き: タブ内の「お知らせ」カテゴリ（お知らせ/アドバイス＝内容種別）、および運営→店舗の「お知らせ」(/admin/announcements「店舗へのお知らせ」・/store/announcements・ヘッダーベル) は名称維持。
- 影響範囲: 顧客側LIFF

## 2026-05-28 – change(store): 進捗 食事カードの99%をkcal横へ・カード高さ揃え・ステータス統一
- change: `app/admin/progress/page.tsx` 食事カードの達成率(%)をkcal表記の横へ移動（下段は食数のみ）。食事/体重カードを h-full で高さを揃えコンパクト化
- change: 進捗のステータス絞り込みに「承認待ち」を追加し顧客設定と項目を統一（すべて/承認待ち/進行中/休止中/卒業）
- 影響範囲: 管理画面（/store・/admin の進捗管理）

## 2026-05-28 – fix/change(store): デモバナー漏れ修正・顧客行ボタン・進捗PFC
- fix: `components/DemoBannerWrapper.tsx` /store・/admin ではデモバナーを表示しない（プレビューiframeのsessionStorageトークンが親に共有され管理画面にバナーが漏れる問題を解消）
- change: `app/admin/customers/page.tsx` デモ顧客行のプレビューを Monitor アイコン→「顧客画面を見る」ラベルボタンに。位置を矢印の左へ（ChevronRight を Link 外に出して末尾配置）
- change: `app/admin/progress/page.tsx` + `app/api/admin/progress/route.ts` 進捗一覧の食事カードに PFC 内訳を表示（APIで P/F/C を日次集計）。レイアウトを食事3/4・体重1/4に変更し体重カードをコンパクト化
- 影響範囲: 管理画面（/store・/admin の顧客設定・進捗管理）、デモバナー（顧客LIFF）、API（/api/admin/progress）

## 2026-05-28 – change(store): 進捗管理・顧客分析 UI 改善
- change: `app/admin/progress/page.tsx` フィルタバーを食事管理と同じ構成（DateRangePicker + 店舗チップ + 顧客select + statusチップ）に刷新。単日運用を維持（from=to 固定）。食事・体重カードをデザイン向上（kcalゲージバー付き）。運動カードを削除。SAMPLE_/DEMO_ 顧客にデモバッジ追加。
- change: `app/admin/analysis/page.tsx` 体重と運動を `WeightExercisePanel` でまとめ直後に隣接表示（単日時横2カラム、期間時縦積み）。`ExerciseSection` に `isSingleDay` 引数追加。期間表示時は日別グループ化（日付見出し付き）で各日の運動記録を視認可能に。
- 影響範囲: 管理画面（/store・/admin の進捗管理・顧客分析）

## 2026-05-28 – change(store): デモ顧客(山田花子)を通常の顧客一覧に表示
- change: `app/admin/customers/page.tsx` サンプル(SAMPLE_/DEMO_)を顧客一覧から除外せず通常行として表示。行内に「デモ」バッジ＋プレビューボタン（読み取り専用）を付与。右矢印で詳細・アカウント削除も可能に。別枠プレビューカードは撤去
- 補足: 席数/課金カウントからは引き続き除外（lib/seats.ts）。見出しの実顧客数(realCustomers)はデモを除外したまま
- 影響範囲: 管理画面（/store・/admin の顧客設定一覧）

## 2026-05-28 – change(store): 食事管理タブをナビから削除（ページ機能は存置）
- change: `app/admin/AdminShell.tsx` のナビから「食事管理」(/meals) タブを削除。未使用となった UtensilsCrossed import も除去
- 補足: /meals ページ（PFC編集・削除）は残置。ナビ以外からの導線は無いため直URLでのみ到達（必要なら顧客分析等から導線追加可）
- 影響範囲: 管理画面（/store・/admin のナビ表示）

## 2026-05-28 – change(store): 顧客プレビューを山田花子の行に集約・ナビ並べ替え
- change: `app/admin/customers/page.tsx` 顧客画面プレビューをデモ用サンプル(山田花子)の行内ボタン（読み取り専用表記）に一本化。別枠プレビューカードを撤去
- change: サンプル判定を `SAMPLE_`/`DEMO_` 両prefix対応に拡張（DEMO_系デモ顧客が実顧客一覧・席数に二重表示される問題を解消）。`lib/seats.ts` も同様に席数除外
- change: `app/admin/AdminShell.tsx` ナビの「顧客分析」を「食事管理」の直後に移動
- 影響範囲: 管理画面（/store・/admin の顧客設定・ナビ・席数集計）

## 2026-05-28 – refactor(announcements): お知らせ機能再設計（運営→店舗専用・顧客巻き戻し）
- refactor: `app/notifications/page.tsx` を a9385af 相当に巻き戻し。`/api/announcements` 取得・マージ・announcementReads 連携を全撤去。個別通知のみ表示に戻す。PageHeader subtitle を「トレーナーからの連絡」に維持。
- refactor: `app/home/_components/LiffGate.tsx` のベル未読バッジを `useInboxUnread` から `useNotificationsUnread`（個別通知のみ）に切り替え。
- refactor: `app/menu/page.tsx` の未読判定を同様に `useNotificationsUnread` に切り替え。
- new: `lib/useNotificationsUnread.ts` 新設。`/api/notifications` の unreadCount のみ返すクライアントフック。SSR/失敗時は 0。
- delete: `lib/useInboxUnread.ts` 削除。顧客向けお知らせ合流の廃止に伴い不要。
- change: `lib/announcementReads.ts` の localStorage キーを `fitmeal_read_announcements` → `fitmeal_store_read_announcements` に変更（店舗ダッシュボード専用に転用）。
- new: `lib/useStoreAnnouncementUnread.ts` 新設。`/api/admin/announcements` から店舗向け一覧を取得し localStorage 既読と突合して未読数を返すフック。
- refactor: `app/admin/reports/page.tsx` を a9385af 相当に巻き戻し。[レポート/お知らせ] トグルとお知らせモードを全撤去。純粋な「レポート送付」に戻す。AdminShell title も「レポート送付」。
- change: `app/admin/AdminShell.tsx` の `/reports` タブラベルを「レポート送付」に戻す。`/announcements` タブを masterOnly+storeHidden の「店舗へのお知らせ」として追加。ヘッダーに store 限定ベルアイコンを追加（`useStoreAnnouncementUnread` で未読バッジ）。
- new: `app/admin/announcements/page.tsx` を master 限定の送信画面に作り替え。宛先は「店舗向け」固定。対象[全店舗/特定店舗]・タイトル/本文/重要度/ピン留め・送信履歴一覧。
- refactor: `app/store/announcements/page.tsx` の re-export を解除し、独自の受信 inbox に作り替え。開いたら `markAnnouncementRead(id)` で localStorage 既読化。
- change: `app/api/admin/announcements/route.ts` GET に「audience=店舗向けのみ返す」フィルタを追加（過去の顧客向けデータ混入防止）。POST の audience デフォルトを `'店舗向け'` に変更。
- 影響範囲: 顧客側 LIFF（/notifications・/home・/menu）、管理画面（/admin/reports・/admin/announcements・/store/announcements・AdminShell）、API（/api/admin/announcements）

## 2026-05-28 – feat(seed): サンプル顧客に個人シートを作成し運動・体重予測を有効化
- feat: `lib/provisionTenant.ts` `seedSampleCustomer` を拡張。新規テナント作成時に個人シート（Notionページ）を自動生成して `食事記録リンク` にセット。
- feat: 既存サンプル顧客（`食事記録リンク` 未設定）を後追い補完するバックフィルロジックを追加（`checkSampleExists` → `getSampleCustomerInfo` に変更し pageId と hasFoodSheetLink を返す）。
- feat: `createFoodSheetPage` 新規関数。heading_2 `📝 記録` + table（11列・ヘッダー1行+直近10日データ）を作成。列[0]=日付(isoToJpMd形式)、[1]=体重、[9]=✅、[10]=運動内容。6〜7日に運動あり。
- fix: `notionPost` を `notionRequest(method, ...)` に汎用化し `notionPatch` ラッパーを追加（顧客ページへの PATCH に対応）。
- 影響範囲: サンプルデモ表示（運動 ✅ 表示・体重予測グラフ）。既存顧客データに変更なし。

## 2026-05-28 – change(store): ナビ順を「顧客設定」先頭に・初期表示を顧客設定へ
- change: `app/admin/AdminShell.tsx` のタブ順を「顧客設定→進捗管理」に入替（ルート一致 `p===base` も顧客設定へ移動）
- change: `app/store/page.tsx`・`app/admin/page.tsx` のルート遷移を常に `/customers`（顧客設定）へ。従来の onboardingCompletedAt 判定による /progress 遷移と不要なテナント照会を撤去
- 影響範囲: 管理画面（/store・/admin のナビ表示順と初期遷移先）

## 2026-05-28 – feat(inbox): お知らせ機能統合（管理側トグル統合・顧客受信箱合流・未読バッジ統一）
- feat: `lib/announcementReads.ts` 新規。localStorage キー `fitmeal_read_announcements` で一斉お知らせの既読ID管理。SSRガード付き。
- feat: `lib/useInboxUnread.ts` 新規。`/api/notifications` + `/api/announcements` を取得し localStorage 既読と突合して合算未読数を返すクライアントフック。LIFF未初期化・失敗時は 0 を返す。
- feat: `app/notifications/page.tsx` 改修。`/api/announcements` も取得して個別通知と一斉お知らせを日時降順マージ表示。一斉お知らせはlocalStorage既読管理（開いたら markAnnouncementRead）。PageHeader subtitle を「トレーナーからの連絡」に変更。
- feat: `app/announcements/page.tsx` をリダイレクトページ化（`router.replace('/notifications')`）。
- feat: `app/admin/reports/page.tsx` 改修。画面最上部に [レポート / お知らせ] pill トグルを追加。URLクエリ `?mode=announcement` で初期タブをお知らせに設定。お知らせモードは旧 admin/announcements/page.tsx のロジック・UIをインライン統合（送信フォーム＋送信履歴）。
- feat: `app/admin/announcements/page.tsx` をリダイレクトページ化（`${base}/reports?mode=announcement` へ転送。/store でも動作）。
- feat: `app/admin/AdminShell.tsx` の `/reports` label を「お知らせ送付」に改名、`/announcements` タブエントリと Megaphone import を削除。
- feat: `app/menu/page.tsx` 改修。「お知らせ」アイコンを Megaphone→Bell に変更、リンク先を `/notifications` に変更、sub を「トレーナーからの連絡」に変更。LIFF初期化後に `useInboxUnread` で未読数を取得し、未読がある場合は Bell アイコン右上に赤丸インジケータを表示。
- feat: `app/home/_components/LiffGate.tsx` の右上ベル未読バッジを `useInboxUnread` に切り替え（個別通知＋一斉お知らせの合算未読数）。
- 影響範囲: 顧客側 LIFF（/notifications・/announcements・/menu・/home）、管理画面（/admin/reports・/store/reports・AdminShell ナビ）

## 2026-05-28 – feat(announcements): お知らせ一斉送信 Phase 1（管理画面・API・lib拡張）
- feat: `lib/announcements.ts` に `AnnouncementAudience`('顧客向け'|'店舗向け')・`AnnouncementStatus` 型を追加、`pageToAnnouncement` で `宛先種別` を読み取り（空は '顧客向け' デフォルト）
- fix: `listAnnouncementsForTenant` に「宛先種別=店舗向けを除外」フィルタを追加（顧客LIFFへの漏れ防止）
- feat: `lib/announcements.ts` に `createAnnouncement`・`listAnnouncementsForStore`・`listAllAnnouncementsAdmin`・`richText` ヘルパーを追加
- feat: お知らせキャッシュキーを `announcements:{tenantId}` / `announcements:store:{tenantId}` に統一し、作成後 `invalidate('announcements:')` で全テナント分を確実にクリア（共有DBのため横断invalidateが必要）
- feat: `app/api/admin/announcements/route.ts` 新規。GET=履歴一覧、POST=一斉お知らせ作成。セッションの role='master' か否かでテナント安全性を強制
- security: 店舗(非master)の対象テナントは `getCurrentTenant()` のコンテキスト由来に固定（クライアント値・session生値を信用せず、staging override も反映）。GET履歴も非masterは「自テナント宛 or 全体」のみに絞り、他店舗お知らせの閲覧を遮断
- feat: `app/admin/announcements/page.tsx` 新規。宛先・対象テナント・タイトル・本文・重要度・ピン留めの作成フォーム＋送信履歴一覧
- feat: `app/store/announcements/page.tsx` 新規（1行 re-export）
- feat: `app/admin/AdminShell.tsx` にナビタブ「お知らせ」(Megaphone)を追加（/analysis と /billing の間）
- 影響範囲: 管理画面（/admin/announcements・/store/announcements）、API（/api/admin/announcements）、lib/announcements.ts

## 2026-05-28 – feat(preview): 顧客動線リデザイン Phase A+B（サンプルシード・席数除外・ストアプレビュー）
- feat: `lib/demoSession.ts` に `generatePreviewToken`（exp 60分）追加、`verifyDemoToken` を kind:'demo'|'preview' 両対応に拡張
- feat: `lib/demoClient.ts` トークン取得優先順位を URLクエリ `preview_token` → sessionStorage → localStorage に変更（プレビューは sessionStorage 隔離、localStorage非汚染）
- feat: `lib/provisionTenant.ts` に `seedSampleCustomer(tenantId, dbIds, notionApiKey)` 追加。テナント作成後に best-effort でサンプル顧客1名（山田 花子）＋直近7日分食事＋9日分体重をシード。lineUserId=`SAMPLE_FITMEAL` で識別、冪等（既存SAMPLE_顧客があればスキップ）
- feat: `lib/notion.ts` 新規テナント食事DBのスキーマ列名を saveFoodRecord と一致させる（`タイトル`→`食事メモ`、`LINEユーザーID`→`LINE_UserID`）
- feat: `lib/seats.ts` lineUserId が `SAMPLE_` 始まりの顧客を席数・総数カウントから除外（誤課金防止）
- feat: `app/api/admin/preview-token/route.ts` 新規エンドポイント。admin 認証必須・tenantId はセッション由来・対象顧客の所属テナント検証後に preview トークンを発行
- feat: `app/admin/customers/page.tsx` ストア顧客一覧に「顧客画面を見る」ボタン（上部: サンプルモード、各行: 実データモード）+ iframe プレビューモーダル追加。サンプル顧客は一覧から分離（席数バナーも実顧客数で表示）
- feat: `app/api/admin/seed-sample/route.ts` staging 検証用 seed エンドポイント（master only、冪等）
- 影響範囲: 管理画面（/store/customers のUI）、API（/api/admin/preview-token・seed-sample）、lib/（demoSession・demoClient・seats・provisionTenant・notion）
- 既存フロー非影響: 公開 /demo（kind:'demo'）は維持。withLiffTenant のデモ分岐は demo/preview 両方を同一ヘッダで処理するため既存経路変更なし

## 2026-05-28 – fix(demo): デモ時にAI/記録アクション行を非表示
- fix: デモモードの /home で「食事記録・AI食事相談・AI献立作成」アクション行を非表示に（読み取り専用デモではPOSTが403になり誤操作でエラー表示される問題を解消。リリース前QA指摘#2対応）
- 影響範囲: 顧客側 LIFF（/home・デモモード時のみ。通常利用は不変）

## 2026-05-28 – feat(demo): LINE不要の顧客画面デモモード実装
- feat: `/demo` 起動ルート + `/api/public/demo/start` トークン発行 API を追加。LIFF・LINE ログイン不要で顧客画面をサンプルデータで体験可能に
- feat: `lib/demoSession.ts` HMAC-SHA256 署名デモトークン発行・検証（inviteToken.ts と同パターン）
- feat: `lib/demoClient.ts` クライアント側デモモード判定の単一ソース（localStorage `fitmeal_demo_token`）
- feat: `lib/withTenant.ts` `withLiffTenant` にデモ分岐追加。`x-demo-token` ヘッダで検証、テナントはトークン内 tenantId のみ、非 GET は 403
- feat: `lib/apiFetch.ts` デモ時は LIFF を呼ばず `x-demo-token` ヘッダで API アクセス
- feat: `lib/liff.ts` + `lib/tenantLiff.ts` デモモード時 LIFF 初期化・login() をスキップ
- feat: `components/DemoBanner.tsx` + `DemoBannerWrapper.tsx` 全ページ上部にデモバナー表示、「デモを終了」で localStorage クリア
- feat: `app/home/_components/LiffGate.tsx` デモ時は食事記録ボタン・WeightExerciseCard・オンボーディング・register リダイレクトを非表示
- 影響範囲: 顧客側 LIFF（新規 /demo + 既存全ページのバナー）、API（新規 /api/public/demo/start + withLiffTenant デモ分岐）
- 既存フロー非影響: `x-demo-token` ヘッダなし時は完全に従来通りの LINE idToken 検証フローを通る

## 2026-05-28 – change(record): 写真アップ完了後の視認性向上
- change(record): 写真アップロード完了後、プレビューエリアまで自動スクロール（scrollIntoView smooth）
- change(record): プレビューエリアの枠を border-2 emerald-300 に強調、ヘッダに CheckCircle2 + 枚数表示を追加してアップロード完了が一目で分かるように

## 2026-05-28 – change(record): 写真読み込み中スピナーをホーム /home と完全同仕様に
- change(record): 写真読み込み中（compressing）のスピナーをホームのカレンダー再取得時と完全に同じ仕様に。下のhub画面（食事を記録）が opacity-50 で透けて見えたまま、中央に緑スピナーを fixed で重ねる
- pointer-events を中央オーバーレイで遮らず（pointer-events-none）、下のコンテナを `pointer-events-none` でブロック

## 2026-05-28 – change(record): 写真読み込み中だけ緑スピナー、解析中/記録中は従来UIに戻す
- change(record): `compressing`（写真アップロード時の圧縮中）のみホーム /home と同じ緑スピナー（白丸 + RefreshCw 緑スピン）に
- 解析中・記録中（stage='analyzing'/'saving'）は従来の全画面モーダル（Camera/Save アイコン + タイトル + 補足文 + ドット3点アニメ + 経過目安）に戻す

## 2026-05-28 – change(profile): 体重目標セクションのアイコン削除
- change(profile): 「体重目標」セクションヘッダから lucide TrendingDown アイコンを削除。タイトル文字のみに（他セクションと統一）
- TrendingDown は他で未使用のため import も削除

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
