'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminAnnouncementsRedirect() {
  const router = useRouter();
  const pathname = usePathname() || '';
  useEffect(() => {
    const base = pathname.startsWith('/store') ? '/store' : '/admin';
    router.replace(`${base}/reports?mode=announcement`);
  }, [router, pathname]);
  return null;
}
