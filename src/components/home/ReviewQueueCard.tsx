'use client';

import Link from 'next/link';
import { useDashboardSummary } from '@/lib/dashboard-context';

const CARD_CLASSES = 'relative flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-white shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/10 dark:shadow-none dark:border-transparent dark:hover:bg-white/20 dark:active:bg-white/25 rounded-2xl text-center transition-colors';

/**
 * Same "חזרה חכמה" card as always, plus a due-count badge once the
 * dashboard summary has loaded and there's actually something due.
 * Zero/loading/no-data → identical to the plain static card.
 */
export function ReviewQueueCard() {
  const { data } = useDashboardSummary();
  const due = data?.reviewDueCount ?? 0;

  return (
    <Link href="/review-queue" className={CARD_CLASSES}>
      {due > 0 && (
        <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow">
          {due > 99 ? '99+' : due}
        </span>
      )}
      <span className="text-3xl">🔄</span>
      <span className="font-semibold text-sm">חזרה חכמה</span>
      <span className="text-slate-500 dark:text-slate-400 text-xs">שאלות שטעית בהן</span>
    </Link>
  );
}
