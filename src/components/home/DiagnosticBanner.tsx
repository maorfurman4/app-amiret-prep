'use client';

import Link from 'next/link';
import { Stethoscope, ChevronLeft } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { CARD_LINK, ICON_TILE } from './surfaces';

/**
 * The quick level check, for students who haven't taken an exam yet: once
 * one has measured them, the exam CTA and their stats say where they stand.
 * Waits for the summary so it never flashes for someone who has; if the
 * summary fails, it shows, so a new student never loses the way in.
 */
export function DiagnosticBanner() {
  const { data, loading } = useDashboardSummary();
  if (loading || (data?.examCount ?? 0) > 0) return null;

  return (
    <Link href="/diagnostic" className={`flex items-center gap-3 p-3.5 ${CARD_LINK}`}>
      <span className={`${ICON_TILE} size-10`}><Stethoscope className="w-5 h-5" strokeWidth={1.75} aria-hidden /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[15px] tracking-[-0.01em]">לא יודע מאיפה להתחיל? אבחון רמה מהיר</span>
        <span className="block mt-0.5 text-[12.5px] leading-snug text-exam-ink-soft">כ-5 דקות. האבחון נעצר ברגע שהרמה ברורה, ונותן לך צעד ראשון.</span>
      </span>
      <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
    </Link>
  );
}
