'use client';

import { Flame } from 'lucide-react';
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
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-exam-alt-bg border border-exam-alt/40">
      <Flame className="w-4 h-4 text-exam-alt animate-streak-flicker motion-reduce:animate-none" fill="currentColor" aria-hidden />
      <span className="text-sm font-bold text-exam-alt tabular-nums">{streak}</span>
      <span className="text-xs text-exam-alt">{streak === 1 ? 'יום רצוף' : 'ימים רצופים'}</span>
    </div>
  );
}
