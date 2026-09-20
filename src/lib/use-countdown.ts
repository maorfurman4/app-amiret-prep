'use client';

import { useEffect, useRef, useState } from 'react';

interface UseCountdownOptions {
  /** Epoch-ms deadline to count down to, or null while there's nothing to run (e.g. data not loaded yet, or the countdown is paused). */
  expiresAt: number | null;
  /** Called once, the first time remaining time reaches 0. */
  onExpire?: () => void;
  /** Poll interval in ms. Default 1000; pass e.g. 500 for a smoother sub-second display. */
  intervalMs?: number;
}

/**
 * Wall-clock-accurate countdown to `expiresAt`. Recomputes remaining time
 * from Date.now() inside a timer callback on every tick — and immediately
 * on tab refocus — instead of naively decrementing a counter each tick; a
 * plain per-tick decrement drifts (or effectively pauses entirely) once the
 * tab is backgrounded, since browsers throttle setInterval there. Returns
 * null exactly when `expiresAt` is null (including the first instant after
 * a deadline is set, before the initial tick lands), so callers can show a
 * "not running yet" state distinct from "just hit zero."
 */
export function useCountdown({ expiresAt, onExpire, intervalMs = 1000 }: UseCountdownOptions): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    // No deadline to run — leave remainingMs at its last value rather than
    // resetting it here (a setState called synchronously in an effect body
    // triggers an extra render for no benefit); callers only ever pass a
    // real, non-null expiresAt once they actually have a deadline.
    if (expiresAt === null) return;

    let fired = false;
    const tick = () => {
      const ms = Math.max(0, expiresAt - Date.now());
      setRemainingMs(ms);
      if (ms <= 0 && !fired) {
        fired = true;
        onExpireRef.current?.();
      }
    };
    const interval = setInterval(tick, intervalMs);
    const initialTick = setTimeout(tick, 0);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAt, intervalMs]);

  return remainingMs;
}
