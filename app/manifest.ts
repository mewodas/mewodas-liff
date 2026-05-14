import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FitMeal',
    short_name: 'FitMeal',
    description: '食事・体重・運動を記録してPFCを自動管理するアプリ',
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
