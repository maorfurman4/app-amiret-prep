import type { SupabaseClient } from '@supabase/supabase-js';
import { thetaToScore } from '@/lib/adaptive';
import { currentEstimate, sessionMeasurement, POOL_WINDOW, type Measurement, type SessionLike } from '@/lib/exemption';
import { localDaysBetween, localMidnight } from '@/lib/date-local';

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
    .limit(POOL_WINDOW);

  const rows = ((data ?? []) as (SessionLike & { completed_at: string })[]).slice().reverse();
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
