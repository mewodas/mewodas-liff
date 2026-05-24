// /signup 配下は公開ページ (Stripe Checkout の success_url 着地)。
// LIFF / Toast 等の店舗向けレイアウトは適用しない。

export const metadata = {
  title: 'FitMeal | お申し込み完了',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
