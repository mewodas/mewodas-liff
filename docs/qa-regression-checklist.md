# QA 回帰チェックリスト

最終更新: 2026-06-05（体重保存主従逆転修正＋AI相談Geminiリトライ追加 9e50d5f 追加）
担当: QA エージェント（fitmeal-qa）

---

## 凡例

- [A] 自動検証可能（curl / API）
- [M] ブラウザ手動が必要
- CORE: 毎リリース必須確認
- SCOPE: 影響範囲がある場合のみ

---

## 顧客 LIFF

### ログイン・認証

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| L1 | LIFF 初期化 → LINE プロフィール取得 → /home 表示 | [M] | CORE |
| L2 | 未登録 LINE ID → /home/register への誘導（LiffGate 経由） | [M] | CORE |
| L3 | 無認証で API 直叩き → 401 返却 | [A] | CORE |
| L4 | 偽トークンで API 直叩き → 401 返却 | [A] | CORE |

### 申し込みフォーム・登録フロー（/home/register）— 2026-05-21 追加・更新

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| REG1 | /api/liff/register: Authorization ヘッダーなし → 401 | [A] | CORE |
| REG2 | /api/liff/register: 偽アクセストークン → 401 | [A] | CORE |
| REG3 | /api/liff/register: LINE 無効トークン（失効済み） → 401 | [A] | CORE |
| REG4 | LINE 内ブラウザでフォームを開き、全項目入力 → 登録完了画面に遷移 | [M] | CORE |
| REG5 | 登録済み LINE ID で再送信 → alreadyRegistered: true の完了画面表示 | [M] | CORE |
| REG6 | 既存 LIFF ルート（/api/day 等）が IDトークン方式のまま動作する | [M] | CORE |
| REG7 | 目標体重・目標達成日を空欄で送信 → 正常登録できること（任意フィールド） | [M] | CORE |
| REG8 | アクセストークン null 時（LINE 外ブラウザは設計外） → triggerReauth() でログイン遷移・ループしない | [M] | SCOPE |

### オンボーディングツアー（/record・/exercise・/weight）— 2026-05-21 吹き出し化

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| TUR1 | /record を初回起動 → 吹き出し型ツアーが表示される（黄色い矢印なし） | [M] | CORE |
| TUR2 | /exercise を初回起動 → 吹き出し型ツアーが表示される | [M] | CORE |
| TUR3 | /weight を初回起動 → 吹き出し型ツアーが表示される | [M] | CORE |
| TUR4 | ツアーの白い三角の尾（tail）が対象要素を指している | [M] | CORE |
| TUR5 | ツアー吹き出しの「次へ」「完了」でツアーが進行・終了する | [M] | CORE |

### 廃止ルート・リダイレクト — 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| DEP1 | POST /api/onboard/redeem → 410 + 廃止案内メッセージ | [A] | CORE |
| DEP2 | GET /api/onboard/redeem → 405（POSTのみ受け付け） | [A] | CORE |
| DEP3 | /onboard → 307 → /home/register に最終着地（200） | [A] | CORE |
| DEP4 | /home/onboard → HTML内 NEXT_REDIRECT で /home/register に遷移（ブラウザで確認） | [M] | SCOPE |
| DEP5 | /home/register ・/home/onboard・/onboard でフッターナビが非表示 | [M] | CORE |

### 管理画面 追加確認 — 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| ADM1 | /admin → 「ユーザー招待フォームをコピー」ボタンが存在する | [M] | CORE |
| ADM2 | 「ユーザー招待フォームをコピー」クリック → URL+テンプレ文がクリップボードにコピーされる | [M] | CORE |
| ADM3 | /admin/customers/[id] → 顧客詳細に「登録完了日時」フィールドが表示される | [M] | CORE |
| ADM4 | ステータスセレクトに「設定中」が存在しない（進行中・休止中・卒業のみ） | [M] | CORE |

### 席数上限 UI/UX — 2026-05-21 追加（commit 7d8990a）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| SEAT1 | /admin: 上限未到達時に上限バナーが表示されない（通常状態） | [M] | CORE |
| SEAT2 | /admin: 上限到達時に「利用可能アカウント数」バナーが全幅で表示される | [M] | SCOPE（上限状態のみ） |
| SEAT3 | /admin: 上限到達時に招待ボタンがグレーアウト・クリック不可 | [M] | SCOPE（上限状態のみ） |
| SEAT4 | /admin: 上限未到達時に招待ボタンが通常の青色でクリック可能 | [M] | CORE |
| SEAT5 | /admin: 残り1席時に amber バナーが表示される | [M] | SCOPE |
| SEAT6 | /admin/billing: 「利用可能アカウント数」表記でプログレスバーが表示される | [M] | CORE |
| SEAT7 | /home/register: 上限未到達テナントでフォームが従来どおり表示・送信できる | [M] | CORE |
| SEAT8 | /home/register: 上限到達テナントで「上限に達しているため、担当トレーナーにお問い合わせください。」の2行案内画面が表示される | [M] | SCOPE（上限状態のみ） |
| SEAT9 | GET /api/liff/register: 認証なし → 401 | [A] | CORE |
| SEAT10 | GET /api/liff/register: 偽トークン → 401 | [A] | CORE |
| SEAT11 | GET /api/liff/register: GET チェックが失敗（サーバエラー等）してもフォームが表示される（フォールスルー） | [M] | CORE |

### 撮影・食事記録

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| R1 | /record → 写真アップロード → AI 解析 → /home へ遷移 | [M] | CORE |
| R2 | /record → 手動入力 → 記録保存 → /home へ遷移 | [M] | CORE |
| R3 | /api/record/analyze: 無認証 → 401 | [A] | CORE |
| R4 | /api/record/manual: 無認証 → 401 | [A] | CORE |
| R5 | mealType 不正値 → 400 | [A] | CORE |

### meal-detail「+メニューを追加」日付引き継ぎ修正（2026-06-07 追加 commit 3ac8726）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| MD1 | /home で**今日より2日以上前**（例: 06/05）の食事区分をタップ → /meal-detail を開き、「+メニューを追加」タップ → /record の「記録対象」日付が /meal-detail ヘッダーの日付と**一致**すること | [M] | CORE（修正対象） |
| MD2 | /meal-detail で過去日付を開いて「+メニューを追加」→ /record の食事区分（朝食/昼食/夕食/間食）が /meal-detail で開いていた区分と一致すること | [M] | CORE（修正対象） |
| MD3 | /home で**今日**の食事区分をタップ → 「+メニューを追加」 → /record の「記録対象」が「今日」 | [M] | CORE（リグレッション） |
| MD4 | /home で**昨日**の食事区分をタップ → 「+メニューを追加」 → /record の「記録対象」が「昨日」 | [M] | CORE（リグレッション） |
| MD5 | /record の日付ナビ（< > ボタン）が正常に動く（±1日移動） | [M] | CORE（リグレッション） |
| MD6 | /record の食事区分切り替え（朝食/昼食/夕食/間食）が正常に動く | [M] | CORE（リグレッション） |
| MD7 | /record → ゴールデンパス（写真 or テキスト記録 → 解析 → 確定保存）が通ること | [M] | CORE（リグレッション） |
| MD8 | /api/today?date=YYYY-MM-DD: 無認証 → 401 | [A] ✅ 3ac8726 staging 確認済み | CORE |
| MD9 | /api/delete POST: 無認証 → 401 | [A] ✅ 3ac8726 staging 確認済み | CORE |
| MD10 | /api/record/update POST: 無認証 → 401 | [A] ✅ 3ac8726 staging 確認済み | CORE |

### ホーム・記録閲覧

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| H1 | /home → 本日の記録カード表示 | [M] | CORE |
| H2 | /history → 過去の食事一覧表示 | [M] | CORE |
| H3 | /weekly → 週次レポート表示 | [M] | CORE |

### AI 献立（/meal-plan）— 2026-05-21 追加

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| MP1 | 「献立を作る」ボタン押下 → 結果表示直後に画面が案1先頭から表示 | [M] | SCOPE |
| MP2 | いずれかの案の「この食事にする」タップ → RecipeSheet が開く | [M] | SCOPE |
| MP3 | RecipeSheet: 記録ボタンがシート下部に固定、手順テキストに重ならない | [M] | SCOPE |
| MP4 | RecipeSheet: シートをスクロールしても記録ボタンが隠れない | [M] | SCOPE |
| MP5 | RecipeSheet: 記録ボタンをタップ → 記録完了 → /menu へ遷移 | [M] | SCOPE |
| MP6 | /api/meal-plan: 無認証 → 401 | [A] | SCOPE |
| MP7 | /api/meal-plan: 偽トークン → 401 | [A] | SCOPE |
| MP8 | /api/meal-plan/recipe: title 未指定 → 400 | [A] | SCOPE |
| MP9 | /api/record/manual: 無認証 → 401（AI 献立からの記録 API） | [A] | SCOPE |

### プロフィール・設定

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| P1 | /profile → 表示・更新保存 | [M] | CORE |
| P2 | /goals → 目標 PFC 表示・更新 | [M] | CORE |
| P3 | /weight → 体重記録 | [M] | CORE |

### 体重保存 / AI相談 バグ修正（2026-06-05 追加 commit 9e50d5f）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| WT1 | /weight → 体重入力→保存 → ホームの「現在体重」に反映される（DB 書き込み = 主ルート確認） | [M] | CORE（修正対象） |
| WT2 | /api/log/weight: 無認証 → 401 | [A] ✅ 9e50d5f | CORE |
| WT3 | /api/log/weight: 正常リクエスト → 200 `{ok:true}` が返る（GAS 結果に関わらず DB 保存成功で 200） | [A] 認証必要 | CORE（修正対象） |
| WT4 | /api/log/weight: GAS が `{ok:false, error:'顧客が見つかりません'}` を返しても 500 にならない（コード確認済み: console.error のみ） | [A] コード確認済み ✅ | CORE（修正の核心） |
| WT5 | /api/log/weight: Notion DB 書き込み自体が失敗した場合は 500 が返る（コード確認済み: dbResult rejected → throw） | [A] コード確認済み ✅ | CORE |
| WT6 | /api/chat: 無認証 → 401 | [A] ✅ 9e50d5f | CORE |
| WT7 | /api/chat: 通常メッセージ → 200 `{ok:true, reply:"..."}` が返る（リトライ追加で正常応答が壊れていないこと） | [A] 認証必要 | CORE（修正対象） |
| WT8 | /api/chat: Gemini 過負荷時（503等）に「Gemini Chat失敗 503: {...}」生JSONでなく「AIが混み合っています。少し時間をおいてからもう一度お試しください。」が error フィールドに入る（コード確認済み） | [A] コード確認済み ✅ | CORE（修正の核心） |
| WT9 | /api/chat: 安全フィルタ（SAFETY）時は「AIが回答を控えました（安全フィルタ）。別の質問をお試しください。」を即返す（リトライしない） | [A] コード確認済み ✅ | CORE |
| WT10 | /api/chat: 空応答時は「AI応答が空でした。もう一度お試しください。」を即返す（リトライしない） | [A] コード確認済み ✅ | CORE |
| WT11 | /home → 体重保存後「体重保存に失敗しました: 顧客が見つかりません」アラートが出ない（自己登録顧客・他テナント顧客でも） | [M] | CORE（バグ再発防止） |
| WT12 | /chat → AI相談で「Gemini Chat失敗 503:...」生JSONが画面に表示されない | [M] | CORE（バグ再発防止） |

---

## 管理画面

### 顧客管理

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| A1 | /admin/customers → 顧客一覧表示 | [M] | CORE |
| A2 | /admin/customers/[id] → 顧客詳細・食事記録一覧表示 | [M] | CORE |
| A3 | /admin: 無認証アクセス → ログイン画面へ | [A] | CORE |

### 分析・AI 解析

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| N1 | /admin/analysis → 日別カロリーグラフ表示 | [M] | CORE |
| N2 | AI 解析 → Gemini 解析結果の表示 | [M] | CORE |

### 店舗・テナント管理

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| S1 | /store → 店舗ダッシュボード表示 | [M] | CORE |
| S2 | /admin/tenants → マルチテナント一覧（master のみ） | [M] | CORE |

### セルフサーブ・オンボーディング（/store/onboarding）— 2026-05-22 追加（commit 5bd2977）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| ONB1 | GET /api/store/onboarding/state: 未認証 → 401 | [A] ✅ | CORE |
| ONB2 | POST /api/store/onboarding/verify-liff: 未認証 → 401 | [A] ✅ | CORE |
| ONB3 | POST /api/store/onboarding/verify-token: 未認証 → 401 | [A] ✅ | CORE |
| ONB4 | POST /api/store/onboarding/build-richmenu: 未認証 → 401 | [A] ✅ | CORE |
| ONB5 | POST /api/store/onboarding/issue-test-token: 未認証 → 401 | [A] ✅ | CORE |
| ONB6 | POST /api/store/onboarding/test-push: 未認証 → 401 | [A] ✅ | CORE |
| ONB7 | POST /api/store/onboarding/state: 未認証（complete:true）→ 401 | [A] ✅ | CORE |
| ONB8 | GET /api/public/tenant-config: tenantId なし → 400 | [A] ✅ | CORE |
| ONB9 | GET /api/public/tenant-config: 存在しない tenantId → 404（CORS ヘッダー付き） | [A] ✅ | CORE |
| ONB10 | OPTIONS /api/public/tenant-config → 204（CORS プリフライト） | [A] ✅ | CORE |
| ONB11 | POST /api/public/onboarding/owner-userid: パラメータなし → 400 | [A] ✅ | CORE |
| ONB12 | POST /api/public/onboarding/owner-userid: 無効トークン → 400 | [A] ✅ | CORE |
| ONB13 | /store/onboarding: 未認証 → /store/login?from=%2Fstore%2Fonboarding にリダイレクト | [A] ✅ | CORE |
| ONB14 | /store/onboarding: 「セットアップ」タブが /store のみ表示（storeOnly: true 制御） | [A] コード確認済み ✅ | CORE |
| ONB15 | /store トップ: onboardingCompletedAt=null → 未完了バナー表示 | [M] | CORE |
| ONB16 | /store トップ: onboardingCompletedAt 設定済み → バナー非表示 | [M] | CORE |
| ONB17 | ウィザード Step 0〜4 の遷移・「戻る」ボタン動作 | [M] | CORE |
| ONB18 | Step 1: LIFF ID 保存 → Step 1 次へボタンが有効化 | [M] | CORE |
| ONB19 | Step 2: リッチメニュー構築ボタン → richMenuId 取得後 Step 2 次へが有効化 | [M] 実 LINE 必要 | CORE |
| ONB20 | Step 4: テストリンク発行 → URL が表示される | [M] | CORE |
| ONB21 | Step 4: テストリンクを LINE で開く → success 画面・ownerLineUserId 登録 | [M] 実 LINE 必要 | CORE |
| ONB22 | Step 4: テスト送信（ownerLineUserId 取得後）→ LINE にメッセージ届く | [M] 実 LINE 必要 | CORE |
| ONB23 | 完了後: /store トップの未完了バナーが消える | [M] | CORE |
| ONB24 | 完了後: 完了画面でリッチメニュー再構築ボタンが動作する | [M] 実 LINE 必要 | SCOPE |
| ONB25 | /home/onboard-test: tenantId・t パラメータなし → エラー画面表示（JS 側） | [M] | CORE |
| ONB26 | /home/onboard-test: 無効トークン → API 400 → エラー画面表示 | [M] | CORE |

### 承認制モード・モード切替（Phase 2）— 2026-05-24 追加（commits d04d705/34c3050）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| APV1 | GET /api/admin/tenant-settings: 未認証 → 401 | [A] ✅ | CORE |
| APV2 | PATCH /api/admin/tenant-settings: 未認証 → 401 | [A] ✅ | CORE |
| APV3 | POST /api/admin/customers/[id]/approve: 未認証 → 401 | [A] ✅ | CORE |
| APV4 | PATCH /api/admin/tenant-settings: inviteMode='invalid' → 400 | [A] コード確認済み ✅ | CORE |
| APV5 | /store/customers: ページロード後「招待方式」切替UI（個別招待/承認制）が表示される | [M] | CORE |
| APV6 | 「承認制」クリック → トースト「承認制モードに切り替えました」表示・ボタン文言が「公開申込URLをコピー（30日有効）」に変わる | [M] | CORE |
| APV7 | ページリロード後も「承認制」が選択されたまま表示される（Notion 永続化） | [M] | CORE |
| APV8 | 承認制モードで「公開申込URLをコピー」→ URL を別 LINE で開く → 名前入力 → 「承認待ち」amber 完了画面表示 | [M] | CORE（最重要） |
| APV9 | 承認待ち顧客が /home を開くと「ジムからの承認待ちです」LiffGate 画面表示（通常 /home ではない） | [M] | CORE（最重要） |
| APV10 | /store/customers の「承認待ち」フィルタタブで申込顧客が yellow バッジ+「承認」ボタン付きで表示 | [M] | CORE（最重要） |
| APV11 | 「承認」ボタン → confirm ダイアログ → OK → トースト「承認しました」→ バッジが「進行中」に変わる | [M] | CORE |
| APV12 | 承認後、その顧客の LINE で /home を開くと通常の食事管理画面（承認待ち画面でない） | [M] | CORE |
| APV13 | 個別招待モードに戻す → 新規登録が「進行中」ステータスになる（回帰） | [M] | CORE |
| APV14 | メヲダス本店テナント: inviteMode 未設定 → 既存顧客 /home が通常動作（影響なし） | [M] 社長実機確認 | CORE |
| APV15 | POST /api/admin/customers/[id]/approve: 別テナントの顧客 pageId を送ると 403 | [A] コード確認済み ✅ | CORE（セキュリティ） |
| APV16 | 承認制テナントで「進行中」の既存顧客が /home を正常に開ける（既存顧客の影響なし） | [M] | CORE |

### tenantId 付き LIFF 回帰（/home・/home/register）— 2026-05-22 追加（commit 5bd2977）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| TID1 | /home（tenantId なし）→ NEXT_PUBLIC_LIFF_ID でフォールバック initLiff・既存動作継続 | [M] 実機 LINE 必要 | CORE |
| TID2 | /home/register（tenantId なし）→ NEXT_PUBLIC_LIFF_ID でフォールバック・フォーム表示 | [M] 実機 LINE 必要 | CORE |
| TID3 | /home（tenantId 付き・liffId 設定済みテナント）→ テナント固有 liffId で initLiff | [M] 実機 LINE 必要 | SCOPE |
| TID4 | /home（tenantId 付き・liffId 未設定テナント）→ フォールバック initLiff・クラッシュしない | [M] | CORE |
| TID5 | /home/register の 401 リトライ: NEXT_PUBLIC_LIFF_ID で再 init・無限ループしない | [M] | CORE |
| TID6 | sessionStorage への tenantId 保存: ページ遷移後も tenantId が引き継がれる | [M] | SCOPE |

### 監査ログ（Phase 0）— 2026-05-29 追加（commit 2d762a0）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| AUD1 | POST /api/admin/auth/login: 正しいmaster認証情報 → 200 + `{"ok":true,"role":"master"}` | [A] | CORE |
| AUD2 | POST /api/admin/auth/login: 正しいtenant_admin認証情報 → 200 + `{"ok":true,"role":"tenant_admin"}` | [A] | CORE |
| AUD3 | POST /api/admin/auth/login: 不正パスワード → 401 + `{"error":"メールアドレスまたはパスワードが違います"}` | [A] | CORE |
| AUD4 | POST /api/admin/auth/login: 存在しないメール → 401 + 同エラーメッセージ | [A] | CORE |
| AUD5 | POST /api/admin/auth/change-password: 誤った現在パスワード → 401（レスポンス変化なし） | [A] コード確認済み | CORE |
| AUD6 | POST /api/admin/auth/change-password: 正常変更 → 200 + `{"ok":true}` | [A] コード確認済み | CORE |
| AUD7 | DELETE /api/admin/customers/[id]: 存在する顧客 → 200 + `{"ok":true}`（アーカイブ後にログ出力） | [A] コード確認済み | CORE |
| AUD8 | DELETE /api/admin/customers/[id]: 存在しない顧客 → 404（ログ呼ばれない） | [A] コード確認済み | CORE |
| AUD9 | POST /api/stripe/update-seats: 正常席数変更 → 200 + `{"ok":true,"newSeats":N}` | [A] コード確認済み | CORE |
| AUD10 | POST /api/admin/invites/create: 正常発行 → 200 + token/tenantId/expiresAt を含む JSON | [A] コード確認済み | CORE |
| AUD11 | 監査ログに password/currentPassword/newPassword/passwordHash/token が含まれていないこと | [A] コード確認済み | CORE（セキュリティ） |
| AUD12 | logAuditEvent 内で例外が発生しても本体レスポンスが止まらない（fire-and-forget） | [A] コード確認済み | CORE |
| AUD13 | 顧客側 LIFF 全エンドポイント（/api/liff/*）が今回のコミットで無変更 | [A] コード確認済み | CORE |

### 監査ログ（Phase 1 Neon 永続化）— 2026-05-29 追加（commit 4acc80b）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| AUD14 | DATABASE_URL 系 env 未設定の staging で login API → 400/401 が従来通り返る（DB 書き込みスキップで 500 にならない） | [A] staging 実機確認済み ✅ | CORE（最重要） |
| AUD15 | POST /api/admin/auth/login: 空ボディ → 400 `{"error":"email/password 必須"}`（graceful 担保） | [A] staging ✅ HTTP 400 確認 | CORE |
| AUD16 | POST /api/admin/auth/login: 存在しないメール → 401 `{"error":"メールアドレスまたはパスワードが違います"}`（graceful 担保） | [A] staging ✅ HTTP 401 確認 | CORE |
| AUD17 | audit_log テーブルへの INSERT が `sql.query(text, params)` パラメータ化クエリで実装されていること | [A] コード確認済み ✅ | CORE（セキュリティ） |
| AUD18 | `sql === null` 時に `insertAuditRow` が即 `Promise.resolve()` で返ること（env 未設定は完全 no-op） | [A] コード確認済み ✅ | CORE（最重要） |
| AUD19 | `waitUntil(p)` を `try { } catch { }` でラップし、リクエストコンテキスト外 throw を握り潰していること | [A] コード確認済み ✅ | CORE |
| AUD20 | `insertAuditRow` の `.catch()` で DB 書き込み失敗がログのみで本体に伝播しないこと | [A] コード確認済み ✅ | CORE |
| AUD21 | login route の ip 取得: `x-forwarded-for` ヘッダーがない場合 `undefined`（空文字でなく）になること | [A] コード確認済み ✅ | CORE |
| AUD22 | login route の userAgent 取得: `user-agent` ヘッダーがない場合 `undefined` になること | [A] コード確認済み ✅ | CORE |
| AUD23 | 本番 Neon 接続後: audit_log テーブルが DDL 通りに作成されること（scripts/migrate-audit-log.mjs 実行） | 本番 Neon 接続後に実施 | CORE |
| AUD24 | 本番 Neon 接続後: login 成功時に audit_log へ 1 行 INSERT されていること（SELECT で確認） | 本番 Neon 接続後に実施 | CORE |
| AUD25 | 本番 Neon 接続後: login 失敗時に audit_log へ outcome='failure' で INSERT されていること | 本番 Neon 接続後に実施 | CORE |
| AUD26 | 本番 Neon 接続後: ip / user_agent カラムに実際の値が入っていること（NULL でないこと） | 本番 Neon 接続後に実施 | CORE |
| AUD27 | 本番 Neon 接続後: password / passwordHash / token が audit_log の metadata カラムに含まれていないこと | 本番 Neon 接続後に実施 | CORE（セキュリティ） |
| AUD28 | 本番 Neon 接続後: Neon DB 書き込み遅延（waitUntil）で login レスポンスタイムが増加していないこと | 本番 Neon 接続後に実施 | CORE（パフォーマンス） |

### AdminShell 左サイドバー刷新 — 2026-06-01 追加（commit 1c69ba2）/ c817df9 でメニュー再編・緑化・トップバー拡大

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| SB1 | /store/* 未認証 → /store/login?from=... に 307 | [A] staging c817df9 確認済み ✅ | CORE |
| SB2 | /admin/* 未認証 → /admin/login?from=... に 307 | [A] staging c817df9 確認済み ✅ | CORE |
| SB3 | /api/admin/auth/me: Cookie なし → 401 | [A] 本番確認済み ✅ | CORE |
| SB4 | /api/admin/auth/logout: Cookie なし → 401（CSRF チェックも有効） | [A] 本番確認済み ✅ | CORE |
| SB5 | store サイドバーアクセントカラーが emerald（選択ハイライト・アクセントバー）| [M] | CORE |
| SB6 | admin サイドバーアクセントカラーが violet | [M] | CORE |
| SB7 | store バッジ「店舗」の文字色・背景色が emerald（アクセントと逆＝既知 nit） | [M] 確認のみ | nit |
| SB8 | admin バッジ「アドミン」の文字色・背景色が violet（アクセントと逆＝既知 nit） | [M] 確認のみ | nit |
| SB9 | md 以上(768px+)でサイドバーが常時固定表示される（ハンバーガーボタン非表示） | [M] | CORE |
| SB10 | md 未満(<768px)でハンバーガーボタンが表示され、タップでドロワー開閉できる | [M] | CORE |
| SB11 | ドロワー背面オーバーレイをタップするとドロワーが閉じる | [M] | CORE |
| SB12 | ドロワー内のナビリンクをタップすると遷移 + ドロワーが閉じる | [M] | CORE |
| SB13 | md 以上で本文がサイドバーと重ならない（md:pl-60 / lg:pl-64 で右オフセット） | [M] | CORE |
| SB14 | 「進捗管理」グループヘッダーをタップで展開/折畳み（active でない場合） | [M] | CORE |
| SB15 | 「設定」グループヘッダーをタップで展開/折畳み（active でない場合） | [M] | CORE |
| SB16 | 進捗管理グループ内ページ（/progress・/meals・/measurements）が現在地のとき、グループが自動展開される | [M] | CORE |
| SB17 | 設定グループ内ページ（/onboarding 等）が現在地のとき、グループが自動展開される | [M] | CORE |
| SB18 | active なグループは畳めない（仕様。active ページ離脱後は折畳み可能） | [M] 仕様確認のみ | minor |
| SB19 | 現在地の項目が背景ハイライト＋左アクセントバー＋右端ドット で強調表示 | [M] | CORE |
| SB20 | store フッター: tenant_admin ロールでパスワード変更リンクが表示される | [M] | CORE |
| SB21 | admin フッター: master ロールでパスワード変更リンクが非表示 | [M] | CORE |
| SB22 | ログアウトボタン押下 → /store/login または /admin/login にリダイレクト | [M] | CORE |
| SB23 | store トップバーのお知らせベル（Bell アイコン）が表示される | [M] | CORE |
| SB24 | admin トップバーにお知らせベルが表示されない（storeOnly） | [M] | CORE |
| SB25 | back prop 渡し時: トップバーに戻るボタン（ChevronLeft）が表示される | [M] | CORE |
| SB26 | ロゴクリック → /store/progress または /admin/progress に遷移 | [M] | CORE |
| SB27 | store ナビ: 顧客管理 / 進捗管理G(進捗一覧・食事一覧・体組成) / 顧客分析 / レポート管理G(レポート作成・テンプレ管理) / 設定G(契約管理・通知設定・店舗一覧・LINE連携設定) ★c817df9 更新 | [M] | CORE |
| SB28 | admin ナビ(tenant_admin): 顧客管理 / 進捗管理G(進捗一覧・食事一覧・体組成) / 顧客分析 / レポート管理G(レポート作成・テンプレ管理) / 設定Gなし ※テナント/プラン/監査なし ★c817df9 更新 | [M] | CORE |
| SB29 | admin ナビ(master): テナント・プラン管理・監査ログが設定グループ内に追加表示される | [M] | CORE |
| SB30 | me 取得前後でちらつきが発生しない（module キャッシュで初回レンダリングが安定） | [M] | CORE |

### サイドバー再編＋store設定緑化＋トップバー拡大 — 2026-06-03 追加（commit c817df9）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| SB31 | store ナビ: 進捗管理グループの子が「進捗一覧」（旧「進捗管理」という子名が無いこと） | [M] | CORE |
| SB32 | store ナビ: 「レポート管理」グループが表示され、開くと「レポート作成」「テンプレ管理」が出る | [M] | CORE |
| SB33 | store ナビ: 「設定」グループを開くと **契約管理→通知設定→店舗一覧→LINE連携設定** の順 | [M] | CORE |
| SB34 | store ナビ: 「設定」グループ内に「テンプレ管理」が無いこと | [M] | CORE |
| SB35 | store ナビ: 「レポート作成」クリックで /store/reports に遷移・ページ正常表示 | [M] | CORE |
| SB36 | store ナビ: 「テンプレ管理」クリックで /store/templates に遷移・ページ正常表示 | [M] | CORE |
| SB37 | store ナビ: 進捗管理を開いてからレポート管理を開くと進捗管理が閉じる（排他） | [M] | CORE |
| SB38 | store ナビ: レポート管理を開いてから設定を開くとレポート管理が閉じる（排他） | [M] | CORE |
| SB39 | /store/notifications（通知設定）: 紫(violet)が残っていない＝緑(emerald)基調 | [M] コード確認済み ✅ | CORE |
| SB40 | /store/onboarding（LINE連携設定）: 紫(violet)が残っていない＝緑(emerald)基調（ボタン・フォーカスリング・ステップインジケーター・コピーボタン） | [M] コード確認済み ✅ | CORE |
| SB41 | トップバー: ベルアイコンが以前より大きい（w-6/h-6、ボタン枠 w-11/h-11） | [M] コード確認済み ✅ | CORE |
| SB42 | トップバー: 「店舗」バッジが以前より大きい（text-sm・px-3.5・py-1.5） | [M] コード確認済み ✅ | CORE |
| SB43 | トップバー: ベル + バッジ拡大後もレイアウト崩れなし（h1 truncate で収まる） | [M] | CORE |
| SB44 | admin ナビ: 「レポート管理」グループが表示され、開くと「レポート作成」「テンプレ管理」が出る（admin も同様） | [M] | CORE |
| SB45 | admin ナビ: master ロールの設定グループ内に「テナント・プラン管理・監査ログ」が表示される（緑化なし＝紫のまま） | [M] | CORE |
| SB46 | admin（/admin/notifications・/admin/onboarding は存在しない）: store専用ページが admin ドメインで誤表示されない（storeOnly 制御） | [A] コード確認済み ✅ | CORE |
| SB47 | /store/reports ページ: レポート管理グループ内「レポート作成」がアクティブ状態でハイライト表示 | [M] | CORE |
| SB48 | /store/templates ページ: レポート管理グループ内「テンプレ管理」がアクティブ状態でハイライト表示 | [M] | CORE |

### 課金制御（billingMode）— 2026-05-22 追加（commits fe8c35a/f4ea56c/bcb152f）

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| BL1 | GET /api/admin/plans: 認証なし → 401 | [A] | CORE |
| BL2 | POST /api/admin/plans: 認証なし → 401 | [A] | CORE |
| BL3 | PATCH /api/admin/plans/[code]: 認証なし → 401 | [A] | CORE |
| BL4 | POST /api/admin/tenants/[id]/apply-stripe: 認証なし → 401 | [A] | CORE |
| BL5 | PATCH /api/admin/tenants/[id]: billingMode='手動' → Stripe連動モードで seatLimit 送信 → 400 | [A] | CORE |
| BL6 | PATCH /api/admin/tenants/[id]: 不正な billingMode 値 → 400 | [A] | CORE |
| BL7 | POST /api/stripe/checkout: 無制限テナントで呼ぶ → 403 | [A] | CORE |
| BL8 | POST /api/stripe/update-seats: 手動テナントで呼ぶ → 403 | [A] | CORE |
| BL9 | GET /api/admin/plans: master Cookie で呼ぶ → 標準プラン1件含むリスト返却 | [A] | CORE |
| BL10 | POST /api/admin/plans: PoC プラン新規作成 → 201 + plan 返却 | [A] | CORE |
| BL11 | PATCH /api/admin/plans/[code]: 作成済みプラン編集 → 200 | [A] | CORE |
| BL12 | /admin/plans: 標準プランが一覧に表示される（Notion Integration アクセス確認） | [M] | CORE |
| BL13 | /admin/tenants/[id]: 課金モードドロップダウンが表示される | [M] | CORE |
| BL14 | /admin/tenants/[id]: 課金モードを「無制限」に変更・保存 → 保存成功メッセージ | [M] | CORE |
| BL15 | /store/billing（テナント staging）: billingMode=無制限 → 「運営管理プラン」表示・申込みフォームなし | [M] | CORE |
| BL16 | /store/billing（テナント staging）: billingMode=手動・席数設定済み → 「運営管理プラン」+席数表示 | [M] | SCOPE |
| BL17 | /store/billing（テナント staging）: billingMode=Stripe連動 → 従来の自己申込みフォームが表示される | [M] | CORE |
| BL18 | /store/billing（Stripe連動）: 席数選択・月額計算・申込みボタン → Stripe Checkout 画面に到達 | [M] | CORE（回帰） |
| BL19 | webhook: Stripe連動 以外のテナントへのサブスク更新イベント → seatLimit 書き換えなし（コードガード確認） | [A] コード確認で代替可 | SCOPE |

---

## バックエンド・非同期処理

| # | 確認項目 | 方法 | 優先度 |
|---|---------|------|-------|
| B1 | cron: 前日レポート送信ジョブがエラーなく完了 | [A] ログ確認 | CORE |
| B2 | Gemini 解析: 画像記録の AI 解析が正常完了 | [M] | CORE |
| B3 | Notion 書き込み: 食事記録が Notion DB に保存される | [A] | CORE |

---

## リリース履歴（QA 実施済み）

| リリース日 | 変更内容 | commit | 判定 |
|-----------|---------|--------|------|
| 2026-06-07 | meal-detail「+メニューを追加」で過去日付が昨日になるバグ修正（date=YYYY-MM-DD 絶対日付化） | 3ac8726 | 条件付き GO（API スモーク全通過・コード精査済み・静的シミュレーション全パス・社長手動確認カード MD1〜MD7 待ち） |
| 2026-06-05 | 体重保存主従逆転（GAS→DB 必須化）＋AI相談 Gemini 503 自動リトライ＋平易文言 | 9e50d5f | 条件付き GO（API スモーク全通過・コード精査済み・社長手動確認カード WT1/WT11/WT12 待ち） |
| 2026-06-03 | サイドバー再編（レポート管理グループ化・進捗一覧改称・設定並び替え）＋store設定緑化＋トップバー拡大 | c817df9 | 条件付き GO（API スモーク全通過・コード精査済み・社長手動確認カード発行済み SB31〜SB48） |
| 2026-06-01 | AdminShell 左サイドバー刷新（モバイル/タブレット/PC 3ブレークポイント対応・グループ展開・ハイライト） | 1c69ba2/53c58d5 | 条件付き GO（API スモーク全通過・コード精査済み・バッジカラー逆転 nit あり・社長手動確認カード発行済み SB5〜SB30） |
| 2026-05-29 | Phase 1 監査ログ Neon 永続化（@neondatabase/serverless 追加・waitUntil flush・ip/userAgent 収集） | 4acc80b | GO（TSコンパイル通過・graceful 設計コード確認済み・staging API 実機確認 HTTP 400/401 正常・顧客LIFF無変更・社長手動確認不要） |
| 2026-05-29 | Phase 0 監査ログ（5エンドポイントに fire-and-forget ログ追加） | 2d762a0 | GO（TSコンパイル通過・機密非漏洩確認済み・顧客LIFF無変更・社長手動確認不要） |
| 2026-05-24 | 承認制モード Phase 2（招待方式切替UI・承認制公開URL・承認操作・LiffGate承認待ち画面） | d04d705/34c3050 | 条件付き GO（自動検証全通過・APV1〜APV4/APV15 コード確認済み。社長手動確認カード発行済み） |
| 2026-05-22 | セルフサーブ・オンボーディング Phase 1（ジム経営者向け LINE 連携ウィザード） | 5bd2977 | 条件付き GO（自動検証全通過・ONB1〜ONB13/ONB8〜ONB12・ONB14 コード確認済み。社長手動確認カード発行済み） |
| 2026-05-22 | 本番スモーク: merge c6a39e4（課金制御フル実装・席数UI改修・Notionバグ修正 7コミット） | c6a39e4 | 本番スモーク OK（自動検証全通過）・社長手動確認カード発行済み（SEAT7/REG4/BL12〜BL18） |
| 2026-05-22 | 課金制御フル実装（billingMode 3種・fitmeal-plans DB・webhook ガード・API ガード） | bcb152f | 条件付き GO（社長手動確認 BL12〜BL18 待ち） |
| 2026-05-21 | lib/notion.ts: createTenantCustomerDb スキーマ補完 + listTenantRows マスタキー分離 | acabbaa | GO（自動検証完全通過・社長手動確認不要） |
| 2026-05-21 | 席数上限 UI/UX 改修（用語統一・バナー全幅・招待無効・登録フォームガード） | 7d8990a | 条件付き GO（社長手動確認待ち） |
| 2026-05-21 | オンボツアー吹き出し化・自己登録フォーム・設定中廃止・招待ボタン・登録完了日時 | 3fa0cf4（merge） | 条件付き GO（社長手動確認待ち） |
| 2026-05-21 | 申し込みフォーム認証方式 IDトークン→アクセストークンに変更 | 61b94a5 | 条件付き GO（社長手動確認待ち） |
| 2026-05-21 | AI献立 UI 3点修正（スクロール位置・ボタン位置・遷移先） | 602ba9c | 条件付き GO |
| 2026-05-21 | 認証オンボーディング画面のフッター非表示 | — | GO（前回） |

---

## 既知の罠・注意事項

- **staging テスト顧客の LINE ID 重複**: 食事一覧が 0 件になる症状。グラフは出るが一覧だけ空の場合はこれを疑う
- `/api/meal-plan/recipe` は設計上認証不要（Gemini API 直叩き、顧客 DB へのアクセスなし）
- `resultTopRef.scrollIntoView` は LIFF 内の iframe スクロールに依存するため、LINE アプリ内ブラウザでの確認が必須
- `/api/liff/register` のみアクセストークン方式（withLiffTenantAccessToken）。他の LIFF ルートは引き続き IDトークン方式（withLiffTenant）。混同注意
- `liff.getAccessToken()` は LINE 外ブラウザで null を返す。設計外ユースケースのため LINE 内ブラウザのみサポート対象
- register フォームの 401 リトライは最大 1 回。その後 `liff.login()` でページ離脱するため無限ループしない設計
- アクセストークンのサーバー側キャッシュは 1 分 TTL（IDトークン側は 5 分 TTL）。高頻度テストでは同じトークンがキャッシュされる場合がある
- `/home/onboard` は Next.js App Router の都合で HTTP 200 を返しつつ HTML 内に `NEXT_REDIRECT;replace;/home/register;307` を含む。ブラウザでは /home/register に遷移する。curl でのステータスコード確認は 200 が正常
- `設定中` ステータスは完全廃止。STATUSES / STATUS_OPTIONS から削除済み。管理画面でこの値を持つ顧客がいた場合は要手動更新（DB上は値が残る可能性あり）
- 「ユーザー招待フォームをコピー」ボタンはコピー内容に URL + テンプレ文を含む。コピー先のテキストにURL以外のテキストが入ることを顧客説明時に注意
- `登録完了日時` は `/api/liff/register` 成功時に Notion に書き込まれる。既存顧客はこの日時が null になる（以前の登録方式では保存されなかったため）
- GET `/api/liff/register` のチェックが失敗（ネットワークエラー・500 等）した場合、catch ブロックで無視してフォームが表示される設計。サーバー側 POST でも上限チェックするため二重防止になっている
- POST `/api/liff/register` で 403（席数上限）が来た場合、over-limit フェーズにはならずフォームに「定員に達しているため…」のエラーメッセージが submitError として表示される（GET チェックをすり抜けた場合の最終防波堤として機能）
- **onboardingTokens.ts のインスタンス問題（設計上の既知制約）**: issueToken と consumeToken はメモリ内 Map で管理（globalThis スコープ）。Vercel がマルチインスタンスを起動した場合、token を発行したインスタンスと verify するインスタンスが異なり、consumeToken が null を返す可能性がある。TTL=15分のベストエフォート設計（CHANGELOG に記載あり）。再発行ボタンで回避可能
- **リッチメニュー URL の /register パス**: lineRichMenu.ts の registerUrl は `liff.line.me/{liffId}/register?tenantId=xxx` → LIFF エンドポイント URL `/home` からの相対パスで `/home/register?tenantId=xxx` に展開される。`/home/register` は存在するルートのため正常
- **register 401 リトライ時の liffId**: フォーム送信後の 401 リトライは process.env.NEXT_PUBLIC_LIFF_ID（デフォルト LIFF ID）で再 init する。tenantId 指定ユーザーが 401 になった場合、テナント固有 liffId でなくデフォルト liffId でリトライする。通常はアクセストークン取得後に 401 が発生するケースはほぼないため実害は低いが、マルチテナント本格展開後は要見直し
- **tenant-config のキャッシュ**: s-maxage=300（5分）。テナントの liffId を更新した直後は CDN キャッシュで古い値が返ることがある。本番でテナント設定変更後 5 分は反映に遅れる場合がある
- 招待ボタンの disabled 状態は `seatInfo` が null（billing/info API 失敗）の場合は enabled になる（失敗時はボタンが使えることが優先）
- 席数カウントは「進行中」のみ。休止中・卒業・**承認待ち**は席数消費しない（承認後に進行中になった時点でカウント）
- **承認制モードで inviteMode='individual' の既存招待URL を使った場合**: kind='individual' が優先されて '進行中' で登録される。承認制テナントでも個別招待URL を別途発行すれば承認不要ルートとして使えるが、意図しない使い方になる可能性があるため注意
- **createTenantCustomerDb に '承認待ち' option なし**: 新テナントの顧客 DB 作成時に「承認待ち」select option はスキーマに含まれていないが、Notion API は存在しない option への書き込みで自動作成するため実害はない。ただし新テナントでは option の並び順が後ろに追加される（既存テナントとは見た目が異なる場合がある）
- **テナントキャッシュ 5分 TTL**: inviteMode を PATCH 後 `invalidateTenantCache()` で即時クリアされるが、エラー時には PATCH が失敗する（楽観的更新は rollback される）。正常系では即時反映
- 席数カウントは「進行中」のみ。休止中・卒業は席数消費しない
- **AdminShell アクセントカラーは store=emerald / admin=violet（c817df9 で修正済み）**: c817df9 以降は isStore=true でアクセント emerald・バッジ emerald。isStore=false でアクセント violet・バッジ violet。両者が統一された
- **store専用ページ（/store/onboarding・/store/notifications）の紫は c817df9 で解消**: violet クラスを全て emerald に置換済み。残存確認はコードで ✅
- **AdminShell active グループは畳めない仕様**: 進捗管理/設定グループ内のページにいるとき、グループヘッダーのトグルを押しても `progressOpen = openGroups.progress || progressActive` の評価で progressActive=true が常に残るため折り畳まれない。設計上の許容挙動（仕様書に記載あり）
- **体重保存の既知残存リスク（9e50d5f 未修正）**: `/api/log/exercise`（ホームの「運動した」簡易トグル）は GAS のみ書き込みで同じ「顧客が見つかりません」が起き得る。データモデルが boolean+free text で DB 版 `/api/exercise-log` と別物のため別途対応が必要（CHANGELOG に既知として記載済み）
- **体重保存の GAS 並列実行**: `Promise.allSettled` で DB と GAS を同時に叩く。GAS の平均レスポンスが遅い場合でも DB 完了後に即 200 を返せる（GAS の待機はしない設計）
- **chatWithAi の maxDuration**: `/api/chat` は maxDuration=30。リトライ最大待機（9秒）＋ API 応答時間（数秒×最大6回呼び出し）で 30 秒を超えるエッジケースが存在する。Vercel Hobby プランでは 30 秒上限が厳格で 504 になり得る。504 は retriable パターンに含まれるため次のリトライで上書きされるが、タイムアウト後のリトライは Function が終了しているため実質的には最終エラーになる。稀なケースで許容範囲（本番で発生したら maxDuration 引き上げを検討）
- **billingMode=null（未設定）は後方互換で Stripe連動 扱い**。新規テナントは Stripe連動 として扱われる
- **billingMode バリデーション**: 許可値は「無制限」「手動」「Stripe連動」の3種のみ。その他の値は Notion の select に新規オプションが作られるのを防ぐため API が 400 を返す
- **手動モードで seatLimit 未設定（null）**: Admin UI で手動モードを選択すると席数入力フィールドが表示される。未入力で保存した場合、seatLimit=null → getSeatStatus では `seatLimit !== null ? ... : false` なので isOverLimit=false（上限なし扱い）になる。設計書のエッジケースに記載あり
- **Stripe連動モードでの seatLimit 直接編集禁止**: PATCH /api/admin/tenants/[id] で Stripe連動のまま seatLimit を送信すると 400 になる。UI 側も手動モード以外では seatLimit 入力フィールドを表示しない（save() 関数で明示的に除外）
- **fitmeal-plans DB の標準プラン**: Stripe PriceID が空の場合は env の STRIPE_PRICE_PER_USER / STRIPE_PRICE_SUPPORT_FEE にフォールバック（planCode=standard のみ）。PoC/エンタープライズで PriceID 未設定の場合は inline price_data が生成される
- **apply-stripe の Stripe反映セクション**: UI 上は billingMode=Stripe連動 または 未設定（空文字）の場合のみ表示される（無制限・手動では非表示）
