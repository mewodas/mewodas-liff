// 管理画面のブランドアクセント色。店舗(/store)=緑(emerald) / 運営(/admin)=紫(violet)。
// 「現在地・選択中・主要アクション」等のブランドアクセントにのみ使用する。
// 成功(✓)・ステータス(進行中=橙/休止中=青)・エラー(赤)・デモ 等の「意味を持つ色」には使わない。
//
// 使い方:
//   const ac = adminAccent(base === '/store');
//   <button className={`... ${active ? ac.pillActive : 'bg-white text-stone-700 border-stone-300'}`}>
//
// 注意: Tailwind JIT が拾えるよう、両ロールの完全なクラス名を文字列リテラルで列挙している。
export type AdminAccent = {
  /** 選択中フィルタチップ等（塗りつぶし+白文字） */
  pillActive: string;
  /** 主要アクションボタン（塗りつぶし+ホバー濃色） */
  btn: string;
  /** focus リング */
  ring: string;
  /** アクセントテキスト */
  text: string;
  /** 淡いアクセント背景 */
  bgSoft: string;
  /** アクセント枠 */
  border: string;
  /** アクセントのドット/バー */
  dot: string;
};

const STORE_ACCENT: AdminAccent = {
  pillActive: 'bg-emerald-500 text-white border-emerald-500',
  btn: 'bg-emerald-600 active:bg-emerald-700',
  ring: 'focus:ring-emerald-500',
  text: 'text-emerald-700',
  bgSoft: 'bg-emerald-50',
  border: 'border-emerald-200',
  dot: 'bg-emerald-600',
};

const ADMIN_ACCENT: AdminAccent = {
  pillActive: 'bg-violet-500 text-white border-violet-500',
  btn: 'bg-violet-600 active:bg-violet-700',
  ring: 'focus:ring-violet-500',
  text: 'text-violet-700',
  bgSoft: 'bg-violet-50',
  border: 'border-violet-200',
  dot: 'bg-violet-600',
};

export function adminAccent(isStore: boolean): AdminAccent {
  return isStore ? STORE_ACCENT : ADMIN_ACCENT;
}
