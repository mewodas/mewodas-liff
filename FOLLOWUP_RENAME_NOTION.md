# Notion リネーム後の作業チェックリスト

Notion の顧客 DB で「現在体重(kg)」→「開始体重(kg)」にリネームした後、以下を実施する。

1. `lib/notion.ts` L257: `properties['現在体重(kg)']` → `properties['開始体重(kg)']`（createCustomer）
2. `lib/notion.ts` L356: `properties['現在体重(kg)']` → `properties['開始体重(kg)']`（updateCustomer）
3. `npm run build` でビルド通過確認
4. staging push → 動作確認 → main マージ
