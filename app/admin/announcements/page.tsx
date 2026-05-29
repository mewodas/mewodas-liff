'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminAnnouncementsRedirect() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const base = pathname.startsWith('/store') ? '/store' : '/admin';

  useEffect(() => {
    router.replace(`${base}/reports?mode=announcement`);
  }, [router, base]);

  return null;
}
