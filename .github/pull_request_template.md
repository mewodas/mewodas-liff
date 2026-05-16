## 概要
<!-- このPRで何を変えたか、なぜ変えたかを1-3行で -->


## 変更タイプ
- [ ] バグ修正
- [ ] 新機能
- [ ] リファクタ（挙動変更なし）
- [ ] 緊急修正（営業中の致命バグ）

## 影響範囲
- [ ] 顧客側 LIFF（/home, /record, /profile, /goals, /announcements, /onboard, /exercise, /weight, /history, FooterNav, OnboardingFlow 等）
- [ ] 管理画面（/admin, /store）
- [ ] バックエンドAPI（/api/*）
- [ ] DB スキーマ（Notion）
- [ ] 環境変数

## ⚠️ 顧客側 LIFF を変更する場合（最重要）

- [ ] **staging ブランチで作業した**（main 直push禁止）
- [ ] **Vercel Preview URL で動作確認した** → URL:
- [ ] **主要動線をテストした**（下記）
- [ ] **オーナーから明示的に承認を得た**

### 主要動線チェック（顧客側変更時は必須）
- [ ] /home が表示される
- [ ] **体重登録ができる**（/weight）← 過去の事故ポイント
- [ ] 写真からの食事登録ができる（/record → 確定 → /home に戻る）
- [ ] AI相談が動く（/chat）
- [ ] フッターナビが正しく出る
- [ ] オンボーディングが固まらない（新規顧客）

## ロールバック手順
<!-- 万一の場合の rollback コミット ID or タグ -->
`git reset --hard <SHA>` → `git push --force-with-lease origin main`

## 関連
<!-- 関連 issue / 会話 / メモ -->
