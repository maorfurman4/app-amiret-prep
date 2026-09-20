'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';

/**
 * Secondary full-width CTA to /today, styled with exam-sage to visually
 * differentiate it from the primary (accent-colored) /exam CTA above it.
 * Shows a due-count badge once the dashboard summary loads and there's
 * something due, same zero/loading/no-data contract as ReviewQueueCard.
 */
export function TodaySessionCta() {
  const { data } = useDashboardSummary();
  const due = data?.todayDueCount ?? 0;

  return (
    <Link
      href="/today"
      className="relative w-full py-3.5 bg-exam-sage-bg hover:opacity-90 border border-exam-sage/40 rounded-md text-lg font-bold text-center text-exam-sage-strong transition-opacity flex items-center justify-center gap-2"
    >
      <Sparkles className="w-5 h-5" aria-hidden />
      התרגול היומי שלי
      {due > 0 && (
        <span className="absolute -top-2 -left-2 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-exam-sage-strong text-white text-[11px] font-bold">
          {due > 99 ? '99+' : due}
        </span>
      )}
    </Link>
  );
}
