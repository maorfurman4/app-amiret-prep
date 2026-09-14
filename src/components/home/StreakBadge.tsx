'use client';

import { useEffect, useRef, useState } from 'react';
import { useDashboardSummary } from '@/lib/dashboard-context';

/**
 * Small daily-streak flame for the home page, Duolingo-style: pops in with
 * a spring bounce and counts up to the real number the first time it
 * appears each page load, then flickers gently while idle. Hidden until a
 * streak exists. The count-up/pop only fire once per mount (guarded by
 * animatedRef) — a later re-render from the same streak value (or any
 * other context update) must not replay the entrance.
 */
export function StreakBadge() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;
  const [displayed, setDisplayed] = useState(0);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (streak < 1 || animatedRef.current) return;
    animatedRef.current = true;

    const duration = 600;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(eased * streak));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [streak]);

  if (streak < 1) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700 animate-streak-pop motion-reduce:animate-none">
      <span className="text-base animate-streak-flicker motion-reduce:animate-none">🔥</span>
      <span className="text-sm font-bold text-orange-700 dark:text-orange-300 tabular-nums">{displayed}</span>
      <span className="text-xs text-orange-600 dark:text-orange-400">{streak === 1 ? 'יום רצוף' : 'ימים רצופים'}</span>
    </div>
  );
}
