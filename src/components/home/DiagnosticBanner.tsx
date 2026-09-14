'use client';

import Link from 'next/link';
import { useDashboardSummary } from '@/lib/dashboard-context';

const BANNER_CLASSES = 'flex items-center gap-3 p-4 -mt-3 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/10 dark:shadow-none dark:border-transparent dark:hover:bg-white/20 dark:active:bg-white/25 rounded-2xl transition-colors';

/**
 * "לא יודע מאיפה להתחיל?" reads oddly once someone already has a real
 * exam score — they already know roughly where they stand. Swap to
 * softer copy once examCount >= 1. No data yet / new user → identical
 * default banner.
 */
export function DiagnosticBanner() {
  const { data } = useDashboardSummary();
  const hasExam = (data?.examCount ?? 0) >= 1;

  const title = hasExam
    ? 'רוצה למדוד את הרמה שלך שוב? אבחון מהיר'
    : 'לא יודע מאיפה להתחיל? אבחון רמה מהיר';
  const sub = hasExam
    ? '12 שאלות אדפטיביות · ~10 דקות · בדיקה מהירה בין מבחנים מלאים'
    : '12 שאלות אדפטיביות · ~10 דקות · רמה + תוכנית מותאמת';

  return (
    <Link href="/diagnostic" className={BANNER_CLASSES}>
      <span className="text-2xl">🩺</span>
      <div className="flex-1 text-right">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-slate-500 dark:text-slate-400 text-xs">{sub}</div>
      </div>
      <span className="text-slate-400">‹</span>
    </Link>
  );
}
