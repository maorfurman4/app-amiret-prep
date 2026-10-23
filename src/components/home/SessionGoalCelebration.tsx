'use client';

import { useEffect, useState } from 'react';
import { DashboardSummaryProvider } from '@/lib/dashboard-context';
import { todayLocalStr } from '@/lib/date-local';
import { GoalMetCelebration } from './GoalMetCelebration';

/** StreakCelebration's once-a-day flag (set the moment its dialog shows). */
const STREAK_SEEN_KEY = 'amiret_streak_celebration_seen_date';
/** SessionStreakCelebration re-asks for up to ~3.5s; past this it isn't coming. */
const STREAK_WAIT_MS = 6000;
const POLL_MS = 250;

/**
 * Mounted on a session's completion screen beside SessionStreakCelebration:
 * the same goal-met celebration as home, fed by the same dashboard summary
 * (fetched once the session's answers have been logged), sharing home's
 * once-a-day flag — so the day celebrates once, on whichever screen gets
 * there first.
 *
 * The streak here can take seconds to decide (it re-asks /api/streak), longer
 * than GoalMetCelebration's own wait for it. So the goal isn't mounted until
 * the streak has shown today (its flag is set; the goal then waits for its
 * dialog to close) or has had its chance.
 */
export function SessionGoalCelebration() {
  const [streakSettled, setStreakSettled] = useState(false);

  useEffect(() => {
    const today = todayLocalStr();
    const shown = () => {
      try { return localStorage.getItem(STREAK_SEEN_KEY) === today; } catch { return false; }
    };
    const started = Date.now();
    const timer = setInterval(() => {
      if (shown() || Date.now() - started >= STREAK_WAIT_MS) {
        clearInterval(timer);
        setStreakSettled(true);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  if (!streakSettled) return null;
  return <DashboardSummaryProvider><GoalMetCelebration /></DashboardSummaryProvider>;
}
