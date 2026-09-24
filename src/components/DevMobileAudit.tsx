'use client';

import { useEffect } from 'react';
import { runMobileAudit } from '@/lib/mobile-audit';

/** Development only: exposes window.__mobileAudit() for the console. Renders nothing. */
export function DevMobileAudit() {
  useEffect(() => {
    (window as unknown as { __mobileAudit: typeof runMobileAudit }).__mobileAudit = runMobileAudit;
  }, []);
  return null;
}
