import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'メヲダス 食事管理',
    short_name: 'メヲダス',
    description: 'メヲダスの食事・体重・運動記録アプリ',
    start_url: '/home',
    display: 'standalone',
    background_color: '#f5f5f4',
    theme_color: '#059669',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
