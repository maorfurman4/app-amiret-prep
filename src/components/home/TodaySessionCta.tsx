'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { DailyRings } from './DailyRings';
import { ReviewDueNudge } from './ReviewDueNudge';

/**
 * The home page's composite "Today" card: daily rings (Pillar 2) + a
 * loss-aversion nudge (Pillar 3) + the CTA to /today, folded into one
 * card instead of three separate blocks competing for attention. Falls
 * back to the plain CTA pill (no rings/nudge) until dashboard data loads,
 * same zero/loading/no-data contract every other home card follows.
 */
export function TodaySessionCta() {
  const { data } = useDashboardSummary();
  const due = data?.todayDueCount ?? 0;

  return (
    <div className="relative">
      {/* Ambient glow — a soft, slowly breathing radial light behind the
          hero card for spatial depth, not a hard drop shadow */}
      <div className="absolute -inset-3 -z-10 rounded-[28px] bg-exam-sage/25 blur-2xl animate-ambient-glow motion-reduce:animate-none" aria-hidden />
      <div className="relative w-full bg-exam-sage-bg/90 backdrop-blur-sm bg-linear-to-br from-exam-surface/50 to-transparent border border-exam-sage/40 dark:border-white/10 rounded-2xl shadow-raised overflow-hidden">
        {data && (
          <div className="flex justify-center pt-4">
            <DailyRings
              activityUnitsToday={data.activityUnitsToday}
              dailyActivityTarget={data.dailyActivityTarget}
              reviewClearedToday={data.reviewClearedToday}
              reviewStillDue={data.todayDueCount}
            />
          </div>
        )}
        <Link
          href="/today"
          className="relative w-full py-3.5 px-4 text-lg font-bold text-center text-exam-sage-strong flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-transform duration-300 ease-spring will-change-transform"
        >
          <Sparkles className="w-5 h-5" aria-hidden />
          התרגול היומי שלי
          {due > 0 && (
            <span className="absolute top-2 left-4 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-exam-sage-strong text-on-emerald text-[11px] font-bold animate-check-pop">
              {due > 99 ? '99+' : due}
            </span>
          )}
        </Link>
        {data && <div className="pb-3 px-4"><ReviewDueNudge dueCount={due} /></div>}
      </div>
    </div>
  );
}
