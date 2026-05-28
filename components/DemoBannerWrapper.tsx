'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isDemoMode, isPreviewMode } from '@/lib/demoClient';
import DemoBanner from './DemoBanner';

export default function DemoBannerWrapper() {
  const pathname = usePathname() || '';
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 公開 /demo（localStorage 由来）でのみバナー表示。
    // ストアの顧客画面プレビュー iframe（preview_token/sessionStorage 由来）では出さない
    // ＝モーダル側で「プレビュー・読み取り専用」を既に明示しているため重複を避ける。
    setShow(isDemoMode() && !isPreviewMode());
  }, []);

  // 管理画面（/store・/admin）ではデモバナーを出さない（sessionStorage 共有での漏れ防止）。
  const isAdminArea = pathname.startsWith('/store') || pathname.startsWith('/admin');
  if (!show || isAdminArea) return null;
  return <DemoBanner />;
}
