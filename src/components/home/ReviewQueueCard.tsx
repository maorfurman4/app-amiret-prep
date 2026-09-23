'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';

const CARD_CLASSES = 'relative flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] text-center transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';

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
        <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-exam-wrong text-on-danger text-[11px] font-bold">
          {due > 99 ? '99+' : due}
        </span>
      )}
      <RotateCcw className="w-7 h-7 text-exam-ink-soft" strokeWidth={1.75} aria-hidden />
      <span className="font-semibold text-sm">חזרה חכמה</span>
      <span className="text-exam-ink-soft text-xs">שאלות שטעית בהן</span>
    </Link>
  );
}
