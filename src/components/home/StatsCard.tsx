'use client';

import Link from 'next/link';
import { useDashboardSummary } from '@/lib/dashboard-context';

const CARD_CLASSES = 'flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-md text-center transition-colors';

/**
 * Same "הסטטיסטיקה שלי" card, subtitle swapped for the last score once
 * it's known. No exams yet / not loaded → identical to the static card.
 */
export function StatsCard() {
  const { data } = useDashboardSummary();
  const sub = data?.lastScore != null
    ? `ציון אחרון: ${data.lastScore}`
    : 'היסטוריה וגרפים';

  return (
    <Link href="/stats" className={CARD_CLASSES}>
      <span className="text-3xl">📊</span>
      <span className="font-semibold text-sm">הסטטיסטיקה שלי</span>
      <span className="text-exam-ink-soft text-xs">{sub}</span>
    </Link>
  );
}
