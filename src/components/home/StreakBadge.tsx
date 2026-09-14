'use client';

import { useDashboardSummary } from '@/lib/dashboard-context';

/**
 * Small daily-streak flame for the home page. Hidden until a streak
 * exists. Just idles with a gentle flicker — the "big" once-a-day
 * celebration moment lives in StreakCelebration.tsx instead, so this
 * stays quiet and doesn't double-announce the same thing.
 */
export function StreakBadge() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;

  if (streak < 1) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700">
      <span className="text-base animate-streak-flicker motion-reduce:animate-none">🔥</span>
      <span className="text-sm font-bold text-orange-700 dark:text-orange-300 tabular-nums">{streak}</span>
      <span className="text-xs text-orange-600 dark:text-orange-400">{streak === 1 ? 'יום רצוף' : 'ימים רצופים'}</span>
    </div>
  );
}
