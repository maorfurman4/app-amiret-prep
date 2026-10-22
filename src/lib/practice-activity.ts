import { localDateStr } from './date-local';
import { ERROR_CAUSES, type ErrorCause } from './error-cause';

/**
 * Owner-scoped aggregates over public.responses for the stats page, kept as
 * pure functions (no DB, no DOM) so they're unit-testable and so /stats never
 * aggregates on its own — same discipline as computeStatsMetrics.
 */

export interface PracticeActivity {
  /** Practice/review questions answered (one per response row). */
  questions: number;
  /** Distinct Israel calendar days with any such activity. */
  days: number;
}

export function computePracticeActivity(rows: { created_at: string }[]): PracticeActivity {
  const days = new Set<string>();
  for (const r of rows) days.add(localDateStr(new Date(r.created_at)));
  return { questions: rows.length, days: days.size };
}

/** Below this many tagged errors a chart would overstate the data — nudge instead. */
export const ERROR_CAUSE_MIN = 5;

export interface ErrorCauseSlice {
  cause: ErrorCause;
  count: number;
  /** Fraction of the student's tagged errors, 0–1. */
  share: number;
}

export interface ErrorCauseBreakdown {
  total: number;
  /** total >= ERROR_CAUSE_MIN — only then is a chart honest. */
  enough: boolean;
  /** Causes the student actually tagged, largest first. */
  slices: ErrorCauseSlice[];
  top: ErrorCause | null;
}

export function aggregateErrorCauses(rows: { error_cause: ErrorCause | null }[]): ErrorCauseBreakdown {
  const counts: Record<ErrorCause, number> = { vocab: 0, logic: 0, time: 0, careless: 0 };
  let total = 0;
  for (const r of rows) {
    if (r.error_cause && r.error_cause in counts) {
      counts[r.error_cause] += 1;
      total += 1;
    }
  }
  const slices: ErrorCauseSlice[] = ERROR_CAUSES
    .map(cause => ({ cause, count: counts[cause], share: total ? counts[cause] / total : 0 }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);
  return { total, enough: total >= ERROR_CAUSE_MIN, slices, top: slices[0]?.cause ?? null };
}
