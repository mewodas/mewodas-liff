# 緊急ロールバック手順

本番（main = customer-facing app.fitmeal.jp）で致命的な不具合が出た時の最短手順。

## 1. 状況把握（30秒）
- 何が壊れているか確認
- 顧客が今この瞬間使えなくなっている → ロールバック判断
- 一部機能だけ → revert で限定対応

## 2. 戻し先を決める

### 候補A: 直前の安定版タグ
```bash
git tag | grep stable | sort | tail -5
# stable-2026-05-15 など、最新の前日タグを使う
git reset --hard stable-2026-05-15
```

### 候補B: 特定コミット
```bash
cd /home/mwds/mewodas-liff
git log --format="%h %ai %s" -20
# 戻したいコミットの SHA をコピー
git reset --hard <SHA>
```

## 3. 安全にロールバック実行

```bash
# (a) 現在の状態をバックアップブランチに保存（消える前に）
git branch backup-$(date +%Y%m%d-%H%M)

# (b) リセット
git reset --hard <戻し先SHA>

# (c) 強制 push（必ず --force-with-lease）
git push origin main --force-with-lease
```

## 4. Vercel デプロイ反映を待つ（1〜2分）
- https://vercel.com/mewodas-projects/fitmeal/deployments
- 最新が「Ready」になったら本番反映完了

## 5. 動作確認チェックリスト
- [ ] /home が表示される
- [ ] /weight で体重登録できる
- [ ] /record で写真から食事登録できる
- [ ] /chat で AI 相談できる
- [ ] フッターナビが正しい

## 6. CHANGELOG.md に記録
- ロールバック先 SHA / 理由 / 失われた機能リスト
- backup ブランチ名

## 7. 復活戦略（後日）
1. backup ブランチから1機能ずつ cherry-pick
2. staging ブランチで作業
3. Preview URL で確認
4. 主要動線テスト
5. main にマージ
