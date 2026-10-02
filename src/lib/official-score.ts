import type { SupabaseClient } from '@supabase/supabase-js';
import { thetaToScore } from '@/lib/adaptive';
import { currentEstimate, sessionMeasurement, POOL_WINDOW, type Measurement, type SessionLike } from '@/lib/exemption';
import { localDaysBetween, localMidnight } from '@/lib/date-local';
import { isLowEffortExam } from '@/lib/exam-effort';

/**
 * NITE score linking — collection side. Each official score a student
 * reports is stored next to what the app predicted for them *before* the
 * test, so the pair (predicted, actual) can later fit a linking function
 * from the app's θ scale to NITE's 50–150 scale.
 */

export type TestType = 'amirnet' | 'amiram' | 'psychometric';

/** After this long without a report or a dismissal, stop asking. */
export const PROMPT_MAX_DAYS = 180;

/**
 * Whether the dashboard should ask for this sitting's official score: the
 * exam date has passed (from the day after), it hasn't been reported, the
 * student hasn't said "prefer not to", and it isn't ancient history.
 */
export function shouldPromptForScore({
  examDate, today, reported, dismissedFor,
}: { examDate: string | null; today: string; reported: boolean; dismissedFor: string | null }): boolean {
  if (!examDate || reported || dismissedFor === examDate) return false;
  const daysSince = localDaysBetween(examDate, today);
  return daysSince >= 1 && daysSince <= PROMPT_MAX_DAYS;
}

export interface PredictionSnapshot {
  app_theta: number | null;
  app_se: number | null;
  app_score: number | null;
  app_p_exempt: number | null;
  app_exams_used: number | null;
  app_days_before: number | null;
}

const EMPTY_SNAPSHOT: PredictionSnapshot = {
  app_theta: null, app_se: null, app_score: null, app_p_exempt: null, app_exams_used: null, app_days_before: null,
};

/** How many recent exams are read to find POOL_WINDOW measured ones — a
 * fetch bound only, so a run of clicked-through exams can't empty the pool. */
export const PREDICTION_SCAN = POOL_WINDOW * 4;

/**
 * The app's prediction as it stood before `testDate`: the same
 * current-estimate rule the stats page shows (last POOL_WINDOW timed exams,
 * precision-pooled, minus any clearly below the latest), over exams
 * completed before the test day began (Israel time).
 */
export async function predictionBefore(
  supabase: SupabaseClient,
  userId: string,
  testDate: string,
): Promise<PredictionSnapshot> {
  const { data } = await supabase
    .from('exam_sessions')
    .select('completed_at, theta_final, theta_se, p_exempt, section_results')
    .eq('user_id', userId)
    .eq('is_practice', false)
    .not('completed_at', 'is', null)
    .not('score', 'is', null)
    .lt('completed_at', localMidnight(testDate).toISOString())
    .order('completed_at', { ascending: false })
    .limit(PREDICTION_SCAN);

  // Exams clicked through at random measured nothing, so the prediction
  // rests on the last POOL_WINDOW exams that did (src/lib/exam-effort.ts).
  const rows = ((data ?? []) as (SessionLike & { completed_at: string })[])
    .filter(r => !isLowEffortExam(r.section_results))
    .slice(0, POOL_WINDOW)
    .reverse();
  const measurements = rows.map(r => sessionMeasurement(r)).filter((m): m is Measurement => m !== null);
  const current = currentEstimate(measurements);
  if (!current || rows.length === 0) return EMPTY_SNAPSHOT;

  const lastExamDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })
    .format(new Date(rows[rows.length - 1].completed_at));
  return {
    app_theta: current.measurement.theta,
    app_se: current.measurement.se,
    app_score: thetaToScore(current.measurement.theta),
    app_p_exempt: current.measurement.p,
    app_exams_used: current.used,
    app_days_before: Math.max(0, localDaysBetween(lastExamDay, testDate)),
  };
}

// ── General entry points (results page, stats page, user menu) ──────────────

export const SCORE_SOURCES = ['exam_date_prompt', 'results', 'stats', 'menu'] as const;
export type ScoreSource = (typeof SCORE_SOURCES)[number];

/** "Prefer not to" on a general entry point stops asking for this long. */
export const GENERAL_DISMISS_DAYS = 60;
/** The results-page line shows on the 1st completed exam and every Nth after. */
export const RESULTS_PROMPT_EVERY = 5;

/**
 * Whether the results page shows its quiet "already took the real test?"
 * line: only for students who have not reported any score, not after a
 * recent "prefer not to", and only on the 1st, 6th, 11th… completed exam,
 * so it never becomes a fixture of every result.
 */
export function shouldShowResultsPrompt({
  completedExams, hasReports, dismissedAt, now,
}: { completedExams: number; hasReports: boolean; dismissedAt: string | null; now: Date }): boolean {
  if (hasReports || completedExams < 1) return false;
  if (dismissedAt && now.getTime() - new Date(dismissedAt).getTime() < GENERAL_DISMISS_DAYS * 86_400_000) return false;
  return (completedExams - 1) % RESULTS_PROMPT_EVERY === 0;
}
