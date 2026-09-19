'use client';

import Link from 'next/link';
import { useDashboardSummary } from '@/lib/dashboard-context';

const BANNER_CLASSES = 'flex items-center gap-3 p-4 -mt-3 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-md transition-colors';

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
        <div className="text-exam-ink-soft text-xs">{sub}</div>
      </div>
      <span className="text-exam-ink-soft">‹</span>
    </Link>
  );
}
