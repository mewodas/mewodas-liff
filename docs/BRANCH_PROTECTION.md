# GitHub ブランチ保護設定ガイド（社長手動設定）

main ブランチを保護して、CI 通過 + PR 必須にすることで「営業中いきなり壊れる」事故を防ぐ。

## 設定手順

1. https://github.com/mewodas/mewodas-liff/settings/branches を開く
2. 「Add branch protection rule」をクリック
3. Branch name pattern: `main`
4. 以下にチェック:
   - [x] Require a pull request before merging
     - [x] Require approvals: **0** （社長1人運用なので承認不要、PR は通すだけ）
   - [x] Require status checks to pass before merging
     - [x] Require branches to be up to date before merging
     - [x] Status checks: `build` (CI ワークフロー)
   - [x] Require conversation resolution before merging
   - [x] Do not allow bypassing the above settings ← **これ重要**（社長自身も縛る）
5. 「Create」で保存

## 例外: Claude Code から緊急 push したい時

緊急バグ修正時のみ、上記設定の **Bypass list に自分のアカウントを一時追加** → 修正 → 設定を戻す。

または、PR を作って「Merge anyway」ボタンで強制マージ（CI 失敗していても可）。
