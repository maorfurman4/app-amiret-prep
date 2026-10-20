'use client';

import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';

/**
 * Same "הסטטיסטיקה שלי" card, subtitle swapped for the last score once
 * it's known. No exams yet / not loaded → identical to the static card.
 * Wears the /stats score panel's navy, so the door looks like the room.
 */
export function StatsCard() {
  const { data } = useDashboardSummary();
  const sub = data?.lastScore != null
    ? `ציון אחרון: ${data.lastScore}`
    : 'היסטוריה וגרפים';

  return (
    <Link
      href="/stats"
      className="flex flex-col items-center gap-1 pt-[18px] pb-4 px-2 min-h-[122px] text-center rounded-[20px] bg-stats-hero text-stats-hero-ink shadow-stats-hero hover:brightness-110 active:scale-[0.98] transition-[filter,transform] duration-300 ease-spring will-change-transform"
    >
      <span className="grid place-items-center size-11 mb-1.5 rounded-xl bg-white/[0.08] text-stats-fill">
        <BarChart3 className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="font-bold text-[15px] tracking-[-0.01em]">הסטטיסטיקה שלי</span>
      <span className="text-stats-hero-soft text-xs">{sub}</span>
    </Link>
  );
}
