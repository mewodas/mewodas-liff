<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 運用ルール（最重要・違反すると顧客に影響）

## 1. CHANGELOG.md 必須更新

すべての変更は `CHANGELOG.md` のトップに追記してから commit する。

形式:
```markdown
## YYYY-MM-DD HH:MM commit-sha
- カテゴリ: 何を変えたか（1行）
- 影響範囲: 顧客側 / 管理画面 / API / DB
- 関連 issue / 会話メモ（任意）
```

CHANGELOG を書かない commit は禁止。レビュー時に差し戻し。

## 2. 顧客側 LIFF 変更はステージング必須

ステージング環境: `staging.fitmeal.jp`（branch: `staging`、開発用LINE公式 + 専用 LIFF + staging テナントDB で本番と完全分離）。詳細は `docs/STAGING.md`。

顧客側ファイル（以下）は **main に直接 push 禁止**:
- `app/home/*` `app/record/*` `app/profile/*` `app/goals/*` `app/announcements/*`
- `app/onboard/*` `app/exercise/*` `app/weight/*` `app/history/*` `app/chat/*` `app/menu/*`
- `app/weekly/*` `app/badges/*` `app/notifications/*` `app/meal-plan/*` `app/meal-detail/*`
- `app/scan/*` `app/food-search/*` `app/my-menu/*` `app/prediction/*` `app/record-menu/*`
- `components/FooterNav.tsx` `components/OnboardingFlow.tsx`
- `components/PageHeader.tsx` 他、顧客から見えるコンポーネント全般
- `app/layout.tsx`（顧客 LIFF 全画面のレイアウト）

ワークフロー:
1. `git checkout staging && git pull` でステージング最新化
2. `git checkout -b staging/<feature-name>` で機能ブランチ作成（任意・staging 直接でもOK）
3. 実装
4. `git push origin staging` で staging ブランチにマージ
5. Vercel が自動で `staging.fitmeal.jp` にデプロイ
6. **オーナー（社長 mwds.bmc@gmail.com）に staging URL を共有して動作確認を依頼**
   - PC: `https://staging.fitmeal.jp/home`
   - LINE: 開発用LINE公式 → staging LIFF
7. **オーナーから明示的に "本番へ反映 OK / mainにマージして" の指示**を受けたら staging → main へ PR 作成・マージ
8. それまでは main に絶対マージしない

main = production = 顧客環境。検証なしの直push は禁止。

## 3. 本番反映はオーナーの明示的指示があるまで実行しない

- staging ブランチで実装して Preview URL を提示するまでが Claude の仕事
- **main マージ・本番デプロイは社長の指示があった時のみ**
- 「進めて」「いいよ」など曖昧な許可では本番反映しない
- 「main にマージして」「本番に出して」「デプロイして」等、明確な指示を待つ
- 緊急バグ修正（営業中に顧客が使えなくなる致命バグ）のみ例外、ただし事後に CHANGELOG で明記

## 4. 管理画面・バックエンドは main 直 push 可

以下は社長しかアクセスしないので main 直 push OK:
- `app/admin/*` `app/store/*` `app/api/admin/*` `app/api/cron/*`
- `app/api/public/apply/*`（顧客から見えるが認証フローのみ）
- `lib/*`（バックエンドのみ）

ただし、これらでも CHANGELOG.md は必ず更新する。

## 5. ロールバック手順

緊急時:
```bash
git tag | grep stable | tail -3
git reset --hard stable-YYYY-MM-DD
git push origin main --force-with-lease
```

詳細は `docs/ROLLBACK_GUIDE.md` 参照。

## 6. 過去事例（再発防止）

- **2026-05-16 朝**: 体重登録が壊れた状態を本番に押し込んでしまった事故。`a102dc7` (5/15 18:06) に2回ロールバック。原因: staging を経由せず main に多数の機能を一気に push したため、回帰テストが追いつかなかった。

---
