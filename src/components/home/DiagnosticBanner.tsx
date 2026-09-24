'use client';

import Link from 'next/link';
import { Stethoscope, ChevronLeft } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';

const BANNER_CLASSES = 'flex items-center gap-3 p-4 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';

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
    ? '6–10 שאלות אדפטיביות · כ-5 דקות · בדיקה מהירה בין מבחנים מלאים'
    : 'כ-5 דקות · נעצר כשהרמה ברורה · מקבלים צעד ראשון ברור';

  return (
    <Link href="/diagnostic" className={BANNER_CLASSES}>
      <Stethoscope className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex-1 text-right">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-exam-ink-soft text-xs">{sub}</div>
      </div>
      <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
    </Link>
  );
}
