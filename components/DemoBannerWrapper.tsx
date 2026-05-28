'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isDemoMode } from '@/lib/demoClient';
import DemoBanner from './DemoBanner';

export default function DemoBannerWrapper() {
  const pathname = usePathname() || '';
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoMode());
  }, []);

  // 管理画面（/store・/admin）ではデモバナーを出さない。
  // プレビュー iframe が sessionStorage に置くトークンが同一オリジンの親（/store）と
  // 共有され、isDemoMode() が true になって管理画面にバナーが漏れるのを防ぐ。
  const isAdminArea = pathname.startsWith('/store') || pathname.startsWith('/admin');
  if (!show || isAdminArea) return null;
  return <DemoBanner />;
}
