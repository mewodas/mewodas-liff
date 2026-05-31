import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FitMeal 店舗管理',
    short_name: 'FitMeal店舗',
    description: '食事管理サービスの店舗運営画面（ジム経営者向け）',
    start_url: '/store',
    scope: '/store',
    display: 'standalone',
    background_color: '#f5f5f4',
    theme_color: '#7c3aed',
    orientation: 'any',
    icons: [
      {
        src: '/fitmeal-favicon.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
