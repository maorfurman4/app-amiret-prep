'use client';

import { useEffect, useState } from 'react';
import { getStreak } from '@/lib/streak';

/** Small daily-streak flame for the home page. Hidden until a streak exists. */
export function StreakBadge() {
  const [streak, setStreak] = useState(0);
  useEffect(() => { setStreak(getStreak()); }, []);
  if (streak < 1) return null;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700">
      <span className="text-base">🔥</span>
      <span className="text-sm font-bold text-orange-700 dark:text-orange-300">{streak}</span>
      <span className="text-xs text-orange-600 dark:text-orange-400">{streak === 1 ? 'יום רצוף' : 'ימים רצופים'}</span>
    </div>
  );
}
