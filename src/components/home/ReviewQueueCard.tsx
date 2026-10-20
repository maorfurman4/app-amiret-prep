'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { ICON_TILE, SQUARE_LINK } from './surfaces';

/**
 * Same "חזרה חכמה" card as always, plus a due-count badge once the
 * dashboard summary has loaded and there's actually something due.
 * Zero/loading/no-data → identical to the plain static card.
 */
export function ReviewQueueCard() {
  const { data } = useDashboardSummary();
  const due = data?.reviewDueCount ?? 0;

  return (
    <Link href="/review-queue" className={SQUARE_LINK}>
      {due > 0 && (
        // The paper-coloured ring cuts the badge out of the tile's corner.
        <span className="absolute -top-[7px] -left-[7px] min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-exam-wrong text-on-danger text-[11.5px] font-extrabold ring-[3px] ring-exam-paper">
          {due > 99 ? '99+' : due}
        </span>
      )}
      <span className={`${ICON_TILE} size-11 mb-1.5`}><RotateCcw className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden /></span>
      <span className="font-bold text-[15px] tracking-[-0.01em]">חזרה חכמה</span>
      <span className="text-exam-ink-soft text-xs">שאלות שטעית בהן</span>
    </Link>
  );
}
