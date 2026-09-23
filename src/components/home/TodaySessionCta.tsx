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
    <div className="w-full bg-exam-sage-bg bg-linear-to-br from-exam-surface/40 to-transparent border border-exam-sage/40 rounded-2xl shadow-surface overflow-hidden">
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
        className="relative w-full py-3.5 px-4 hover:opacity-90 text-lg font-bold text-center text-exam-sage-strong transition-opacity flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" aria-hidden />
        התרגול היומי שלי
        {due > 0 && (
          <span className="absolute top-2 left-4 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-exam-sage-strong text-on-emerald text-[11px] font-bold">
            {due > 99 ? '99+' : due}
          </span>
        )}
      </Link>
      {data && <div className="pb-3 px-4"><ReviewDueNudge dueCount={due} /></div>}
    </div>
  );
}
