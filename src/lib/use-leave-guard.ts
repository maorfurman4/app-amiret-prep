'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LeaveGuard } from './leave-guard';

/**
 * While `active`, browser/OS Back asks `message` before leaving the page
 * (src/lib/leave-guard.ts). Returns the page's own exit controls:
 *  - confirmExit(): asks the same question (true when nothing is at stake);
 *  - leave(href): leaves without asking again, keeping history clean.
 */
export function useLeaveGuard(active: boolean, message: string) {
  const router = useRouter();
  const guardRef = useRef<LeaveGuard | null>(null);
  const messageRef = useRef(message);
  useEffect(() => { messageRef.current = message; }, [message]);

  useEffect(() => {
    guardRef.current ??= new LeaveGuard(window, {
      confirmLeave: () => window.confirm(messageRef.current),
      navigate: href => router.replace(href),
    });
    const guard = guardRef.current;
    if (!active) {
      // The run ended here (or never started): drop the guard entry.
      guard.release();
      return;
    }
    guard.attach();
    return () => guard.detach();
  }, [active, router]);

  const confirmExit = useCallback(() => !active || window.confirm(messageRef.current), [active]);

  const leave = useCallback((href: string) => {
    const guard = guardRef.current;
    if (!guard || !active) { router.push(href); return; }
    guard.leave(href);
    setTimeout(() => guard.flushLeave(), 1000);
  }, [active, router]);

  return { confirmExit, leave };
}
