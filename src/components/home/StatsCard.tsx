'use client';

import Link from 'next/link';
import { useDashboardSummary } from '@/lib/dashboard-context';

const CARD_CLASSES = 'flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-white shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/10 dark:shadow-none dark:border-transparent dark:hover:bg-white/20 dark:active:bg-white/25 rounded-2xl text-center transition-colors';

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
      <span className="text-slate-500 dark:text-slate-400 text-xs">{sub}</span>
    </Link>
  );
}
