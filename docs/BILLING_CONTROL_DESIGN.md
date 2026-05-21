# FitMeal 課金制御 設計書

策定: 2026-05-21 / ステータス: 設計確定・実装待ち

## 目的

1. 社長のテストアカウント（mewodas テナント）を Stripe 解約しても、上限なく動かせるようにする。
2. アカウント数（席数）とプランを admin（マスター）側で一元制御できるようにする。
3. PoC 向けプラン（サポート費なし・最低3席）、エンタープライズ向け個別プランを admin で作成し、Stripe に反映できるようにする。

## 確定した方針

- 進め方: Phase 1/2 を分けず **一括実装**。
- プラン定義の管理: Notion 専用 DB `fitmeal-plans` を新設。
- `/store/billing`（顧客側課金画面）: **標準プランの自己申込みは継続**。PoC・エンタープライズは admin 専用。

---

## 現状の制約（なぜ作り変えるか）

- `seatLimit`（Notion「契約席数」）の唯一の真実が Stripe webhook。テスト契約を解約すると `handleSubscriptionDeleted` が `seatLimit: null` / `paymentStatus: 解約済み` / `status: 解約` を書き込む。
- `getSeatStatus` は `seatLimit === null` を「無制限」と解釈する（`isOverLimit` が `false`）。解約すれば一応無制限にはなるが、これは設計意図ではない副作用で、`paymentStatus: 解約済み` が残り UI バナー・将来の課金ゲートの誤作動源になる。webhook 再送・再契約・手動編集で簡単に壊れる。
- プラン（サポート費 ¥5,500・Volume 単価 ¥2,750/2,200/1,650・`MIN_SEATS=3`）は `lib/stripe.ts` にハードコード。PoC・エンタープライズ個別価格を表現できない。
- 課金操作の起点が `/store/billing`（テナント自己申込み）にあり、運営が横断制御する口がない。`app/store/billing/page.tsx` は `app/admin/billing/page.tsx` を re-export した同一コンポーネント。

---

## 設計の核 1：テナントに「課金モード」を導入

`fitmeal-tenants` に `課金モード`（select）を追加する。

| 課金モード | 席数の真実（source of truth） | Stripe | 用途 |
|---|---|---|---|
| **無制限** | なし（∞・`seatLimit` を無視） | 連携しない | 社長テスト・社内デモ |
| **手動** | Notion「契約席数」を admin が直接入力 | 連携しない | 無償 PoC・特例契約 |
| **Stripe連動** | Stripe サブスクの per-user quantity を webhook 同期 | 連携する | 通常の有償顧客（現状の挙動） |

**ルール: 席数の真実はモードで決まる。**
- `無制限` → `seatLimit` 無視、`isOverLimit` 常に false。
- `手動` → Notion の数値が真実。admin が直接編集。webhook は触らない。
- `Stripe連動` → Stripe が真実。席数変更は Stripe 経由（webhook が同期）。admin の直接編集は不可。

---

## 設計の核 2：プラン定義 DB `fitmeal-plans`

Notion に新規 DB を作成。標準プランも 1 行として登録し、扱いを統一する。

| プロパティ | 型 | 説明 |
|---|---|---|
| `プラン名` | title | 例「標準プラン」「PoCプラン」「エンタープライズ_◯◯ジム」 |
| `プランコード` | rich_text | コードから一意に引く安定キー。例 `standard` / `poc` / `ent_acme` |
| `種別` | select | 標準 / PoC / エンタープライズ |
| `サポート費` | number | 月額・税込・円。`0` = サポート費なし（line item を出さない） |
| `per-user単価` | number | 月額・税込・円/人。`Volume適用` が true のプランでは未使用 |
| `Volume適用` | checkbox | true: 席数に応じた段階単価（コードの段階表を使用。標準プランのみ） |
| `最低席数` | number | 最低契約席数。標準・PoC は 3。エンタープライズは個別 |
| `請求サイクル` | select | 月払い / 年払い |
| `Stripeサポート費PriceID` | rich_text | 空なら inline `price_data` でサポート費を生成 |
| `Stripe per-user PriceID` | rich_text | 空なら inline `price_data` で per-user を生成 |
| `公開` | checkbox | true: `/store/billing` の自己申込みに表示（標準プランのみ true 想定） |
| `有効` | checkbox | false: 新規割当不可（既存契約は維持） |
| `備考` | rich_text | 任意メモ |

### Volume 段階表はコード側で保持

段階単価を使うのは標準プラン 1 種のみ。Notion で段階表は扱いにくいため、3 段階（1-20:¥2,750 / 21-50:¥2,200 / 51+:¥1,650）は `lib/stripe.ts` の定数 `STANDARD_VOLUME_TIERS` のまま保持する。`Volume適用 = true` のプランだけこの定数を参照し、それ以外は `per-user単価` の flat 単価を使う。

### テナント行への追加プロパティ

| プロパティ | 型 | 説明 |
|---|---|---|
| `課金モード` | select | 無制限 / 手動 / Stripe連動 |
| `プランコード` | rich_text | `fitmeal-plans` の `プランコード` を参照（relation ではなく文字列キーで保持し、解決コストを下げる） |

既存の `プラン`（select）列は legacy として残置。新規ロジックは `プランコード` を参照する。

---

## 価格・Stripe 反映の方式

`lib/stripe.ts` を「プラン定義（`PlanDef`）を受け取って金額と line item を組み立てる」関数群に一般化する。

- `getMonthlyTotal(plan, seats)` — `SUPPORT_FEE` / `MIN_SEATS` 定数依存をやめ、`plan` から算出。
- `buildSubscriptionLineItems(plan, seats)` — Checkout / Subscription 用 line item を生成。
  - `plan.supportFee === 0` → サポート費 line item を出さない。
  - Stripe Price ID が設定済み → その Price を使用。
  - Stripe Price ID 未設定（PoC・エンタープライズの個別単価） → inline `price_data` で flat 単価を生成。Stripe Price オブジェクトを量産せずに済む。

### 新規契約の Stripe 反映

`/admin/tenants/[id]` の「Stripe に反映」アクション:
- 未契約 → Checkout Session を生成し、URL を発行。admin がコピーして顧客に送付（顧客がカード入力）。
- 契約済み → `subscription.update` で line item の価格・数量を入替（プラン変更・席数変更とも対応）。`proration_behavior` は既存同様 `create_prorations`。

### webhook の per-user item 識別

現状は env の Price ID のみで識別。プラン複数化に伴い:
- 全プラン定義の `Stripe per-user PriceID` ＋ env の Price ID を集合として持ち、一致する item を per-user とみなす。
- inline `price_data` のサブスク（Price ID が一時 ID で識別不可）は `subscription.metadata.seats` / `metadata.planCode` で判定（checkout・update 時に必ず metadata を埋める）。

---

## 変更ファイル一覧

### Notion スキーマ（notion-ops 担当）
- `fitmeal-tenants`: `課金モード`・`プランコード` を追加。既存テナントは `課金モード = Stripe連動` で埋める。
- `fitmeal-plans`: 新規 DB 作成。標準プラン 1 行（`種別=標準`, `Volume適用=true`, `最低席数=3`, Stripe Price ID は本番 env 値）を登録。
- `fitmeal-tenants` の `支払いステータス` select に `社内` を追加（無制限モード表示用。任意）。

### lib 層
- `lib/notion.ts`: `TenantRow` に `billingMode` / `planCode` 追加。`listTenantRows` / `updateTenantRow` 対応。`fitmeal-plans` の read/write 関数（`listPlans` / `getPlanByCode` / `createPlan` / `updatePlan`）追加。`PlanDef` 型を定義。
- `lib/stripe.ts`: `SUPPORT_FEE` / `MIN_SEATS` 定数をプラン定義由来に。`getMonthlyTotal(plan, seats)` / `buildSubscriptionLineItems(plan, seats)` / `STANDARD_VOLUME_TIERS` 定数を整備。
- `lib/seats.ts`: `getSeatStatus` を `課金モード` で分岐。戻り値に `seatSource: 'unlimited' | 'manual' | 'stripe'` を追加。
  - `無制限` → `seatLimit: null`, `isOverLimit: false`。
  - `手動` → Notion の `seatLimit` で判定（モード切替時に席数入力を必須とする）。
  - `Stripe連動` → 現状通り。

### Stripe webhook
- `app/api/stripe/webhook/route.ts`: `handleSubscriptionUpdate` / `handleSubscriptionDeleted` / `handleInvoicePaymentFailed` の冒頭で対象テナントの `課金モード` を確認し、`Stripe連動` 以外は早期 return（`seatLimit` / `paymentStatus` / `status` を書き換えない）。per-user item 識別をプラン定義基準に一般化。

### API
- `app/api/admin/plans/route.ts`（新規）: `fitmeal-plans` の一覧 GET / 作成 POST。`withMasterOnly`。
- `app/api/admin/plans/[code]/route.ts`（新規）: プラン編集 PATCH。`withMasterOnly`。
- `app/api/admin/tenants/[id]/route.ts`: PATCH に `billingMode` / `seatLimit` / `planCode` を追加。
- `app/api/admin/tenants/[id]/apply-stripe/route.ts`（新規）: テナントのプラン・席数を Stripe に反映（新規 Checkout 発行 or 既存 subscription 更新）。`withMasterOnly`。
- `app/api/stripe/checkout/route.ts`: `planCode` を受け取り、プラン定義から line item を生成。metadata に `planCode` を必ず付与。
- `app/api/stripe/update-seats/route.ts`: プラン変更（価格入替）にも対応。

### Admin UI
- `app/admin/plans/page.tsx`（新規）: プラン一覧・新規作成・編集。
- `app/admin/tenants/[id]/page.tsx`: 課金モード切替、手動モード時の席数入力、プラン選択、「Stripe に反映」ボタンを追加。

### 顧客側
- `app/admin/billing/page.tsx`（= `/store/billing` 共有コンポーネント）:
  - `課金モード` が `無制限` / `手動` のテナント → 「運営管理プラン」表示にし、自己申込み・席数変更 UI を隠す。`解約済み` / `未払い` バナーは課金モード優先で抑制。
  - `Stripe連動` → 標準プラン（`公開 = true`）の自己申込み・席数変更を継続。

---

## 実装順序（一括リリース内の内部順序）

1. notion-ops: `fitmeal-plans` DB 作成、`fitmeal-tenants` にプロパティ追加、標準プラン行登録、既存テナントを `Stripe連動` で埋め。
2. fitmeal-engineer: lib 層（`notion.ts` 型・プラン関数、`stripe.ts` 一般化、`seats.ts` 分岐、webhook ガード）。
3. fitmeal-engineer: API（plans CRUD、tenants PATCH 拡張、apply-stripe、checkout/update-seats のプラン対応）。
4. fitmeal-engineer: Admin UI（`/admin/plans`、`/admin/tenants/[id]`）。
5. fitmeal-engineer: `/store/billing`（= billing 共有コンポーネント）のプラン・課金モード対応。
6. code-reviewer: tenant_id フィルタ漏れ・型安全・Notion クエリ効率レビュー。
7. fitmeal-qa: staging で QA（顧客側 UI 変更を含むため必須）。Go/No-Go 判定。
8. 社長確認 → main マージ → 本番スモーク（fitmeal-qa）。

---

## テストアカウント解約 運用手順（実装・本番反映後）

1. `/admin/tenants/mewodas` で `課金モード` を **無制限** に変更。
2. Stripe ダッシュボードまたは Customer Portal でテスト契約を解約。
3. `subscription.deleted` webhook が発火 → ハンドラが `課金モード = 無制限` を検出し早期 return。`seatLimit` / `paymentStatus` は書き換えられない。
4. mewodas は無制限のまま稼働。`/store/billing` は「運営管理プラン」表示、解約済みバナーは出ない。

> 順序が重要: **必ず「無制限に変更」→「Stripe 解約」の順**で行う。先に解約すると `paymentStatus: 解約済み` が一時的に書き込まれる（無制限モードに切り替えれば席数は無制限になるが、表示クリーンアップのため手順を守る）。

---

## エッジケース・留意点

- **手動モードで `seatLimit` 未設定（null）**: Admin UI で課金モード切替時に席数入力を必須化する。
- **無制限/手動モードのテナント表示**: `paymentStatus` は webhook が更新しないため stale になりうる。UI は `課金モード` を優先して状態ラベルを出す（無制限=「社内利用」、手動=「運営管理プラン」）。
- **LIFF 顧客側のゲート**: 実装時に LIFF 顧客側（/home, /record 等）が `paymentStatus` でアクセス制御していないか確認する。していれば課金モードを考慮するよう修正。
- **inline price_data と Volume の非互換**: PoC・エンタープライズの個別単価は flat（Volume 段階なし）。Volume 段階が必要なのは標準プランのみ、という前提を維持する。
- **webhook ループ**: 手動・無制限モードは webhook が早期 return するためループは発生しない。Stripe連動モードは admin→Stripe→webhook→Notion の一方向で、admin の直接 seatLimit 編集を禁止することで二重更新を防ぐ。
