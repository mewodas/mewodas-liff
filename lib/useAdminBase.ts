'use client';

import { usePathname } from 'next/navigation';

/**
 * 管理画面のルートプレフィックスを返す。
 * - `/admin/*` でアクセス時: '/admin' （マスタ用、テナント管理含む）
 * - `/store/*` でアクセス時: '/store' （店舗用、テナント管理なし）
 */
export function useAdminBase(): '/admin' | '/store' {
  const pathname = usePathname() || '';
  return pathname.startsWith('/store') ? '/store' : '/admin';
}
