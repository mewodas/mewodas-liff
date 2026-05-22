import { ToastProvider } from '@/components/Toast';

/**
 * /admin 配下の共通レイアウト。
 *
 * 完了トースト用の ToastProvider をここでマウントする。レイアウトは
 * ページ遷移してもアンマウントされないため、保存→一覧へ遷移しても
 * トーストが残り続ける。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
