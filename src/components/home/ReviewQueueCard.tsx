'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { reviewsLeftToday } from '@/lib/rings';
import { heCount } from '@/lib/hebrew-count';
import { ICON_TILE, SQUARE_LINK } from './surfaces';

/**
 * Same "חזרה חכמה" card as always, plus a badge with the reviews left in
 * today's goal (src/lib/rings.ts reviewTarget, at most 8), never the
 * whole backlog.
 * Zero/loading/no-data → identical to the plain static card.
 */
export function ReviewQueueCard() {
  const { data } = useDashboardSummary();
  const left = data ? reviewsLeftToday(data.rings.retention) : 0;

  return (
    <Link href="/review-queue" className={SQUARE_LINK}>
      {left > 0 && (
        // The paper-coloured ring cuts the badge out of the tile's corner.
        <span aria-hidden className="absolute -top-[7px] -left-[7px] min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-exam-wrong text-on-danger text-[11.5px] font-extrabold ring-[3px] ring-exam-paper">
          {left}
        </span>
      )}
      <span className={`${ICON_TILE} size-11 mb-1.5`}><RotateCcw className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden /></span>
      <span className="font-bold text-[15px] tracking-[-0.01em]">חזרה חכמה</span>
      <span className="text-exam-ink-soft text-xs">שאלות שטעית בהן</span>
      {left > 0 && <span className="sr-only">, {heCount(left, 'review')} להיום</span>}
    </Link>
  );
}
