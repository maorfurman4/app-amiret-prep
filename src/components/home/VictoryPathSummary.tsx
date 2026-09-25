'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';

const TARGET_SCORE = 134;

/**
 * One-line compact version of the /stats Victory Path chart — just the
 * headline projection, no chart, linking through to the full card. Hidden
 * whenever there isn't a trustworthy forecast yet (new account, or not
 * enough spread-out exams — see src/lib/forecast.ts's guardrail), same
 * zero/loading/no-data contract as every other home-page card.
 */
export function VictoryPathSummary() {
  const { data } = useDashboardSummary();
  const forecast = data?.forecast;

  if (!forecast || forecast.daysToTarget === null) return null;

  return (
    <Link
      href="/stats"
      className="flex items-center gap-2 px-4 py-2.5 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] text-sm transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform"
    >
      <TrendingUp className="w-4 h-4 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
      {forecast.daysToTarget === 0 ? (
        <span className="text-exam-ink">
          הגעת ל-<span className="font-bold text-exam-sage-strong tabular-nums">{TARGET_SCORE}+</span>. כל הכבוד!
        </span>
      ) : (
        <span className="text-exam-ink">
          בקצב הנוכחי שלך: <span className="font-bold text-exam-ink tabular-nums">{TARGET_SCORE}</span> בעוד כ-
          <span className="font-bold text-exam-ink tabular-nums">{' '}{forecast.daysToTarget}</span> ימים
        </span>
      )}
    </Link>
  );
}
