'use client';

import { useEffect, useState } from 'react';
import { isDemoMode } from '@/lib/demoClient';
import DemoBanner from './DemoBanner';

export default function DemoBannerWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoMode());
  }, []);

  if (!show) return null;
  return <DemoBanner />;
}
