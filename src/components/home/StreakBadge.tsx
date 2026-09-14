'use client';

import { useEffect, useRef, useState } from 'react';
import { useDashboardSummary } from '@/lib/dashboard-context';

/** Same "today" definition as the server-side streak calc (lib/streak-server.ts). */
const TZ = 'Asia/Jerusalem';
function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

const ANIM_SEEN_KEY = 'amiret_streak_anim_seen_date';

/**
 * Small daily-streak flame for the home page, Duolingo-style. The entrance
 * pop + count-up plays once per CALENDAR DAY, not once per page load —
 * gated via a localStorage date stamp, so refreshing/renavigating to the
 * home page five times today shows the flame at its resting value each
 * time after the first. Idle flicker keeps running regardless (it's
 * ambient, not an "event"). Hidden until a streak exists.
 */
export function StreakBadge() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;
  const [displayed, setDisplayed] = useState(0);
  const [playPop, setPlayPop] = useState(false);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (streak < 1 || animatedRef.current) return;
    animatedRef.current = true;

    const today = todayLocal();
    if (localStorage.getItem(ANIM_SEEN_KEY) === today) {
      setDisplayed(streak);
      return;
    }
    localStorage.setItem(ANIM_SEEN_KEY, today);
    setPlayPop(true);

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
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700 motion-reduce:animate-none ${playPop ? 'animate-streak-pop' : ''}`}
    >
      <span className="text-base animate-streak-flicker motion-reduce:animate-none">🔥</span>
      <span className="text-sm font-bold text-orange-700 dark:text-orange-300 tabular-nums">{displayed}</span>
      <span className="text-xs text-orange-600 dark:text-orange-400">{streak === 1 ? 'יום רצוף' : 'ימים רצופים'}</span>
    </div>
  );
}
