import type { Metadata } from 'next';
import InstallPrompt from './InstallPrompt';

export const metadata: Metadata = {
  title: 'FitMeal 店舗管理',
  manifest: '/store/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FitMeal店舗',
  },
  themeColor: '#7c3aed',
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
