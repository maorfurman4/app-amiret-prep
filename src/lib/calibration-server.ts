import type { SupabaseClient } from '@supabase/supabase-js';
import { BASELINE_A } from '@/lib/adaptive';
import { ELO_K0, ELO_N0, MIN_CALIBRATION_HISTORY } from '@/lib/calibration';

/** Per-question time budget in the real exam (seconds): SC 4 min / 4,
 * restatement 6 min / 3, reading 15 min / 5. */
const TIME_BUDGET_SECONDS: Record<string, number> = {
  sentence_completion: 60,
  restatement: 120,
  reading_comprehension: 180,
};

/** Answered faster than this share of the time budget → too fast to have read the item. */
export const RAPID_GUESS_SHARE = 0.05;

/**
 * A rapid guess says nothing about the item, so it is kept out of item
 * calibration — the only place response time is used. It never touches a
 * score, the stats, or review scheduling.
 */
export function isRapidGuess(type: string, latencyMs: number | null): boolean {
  if (latencyMs === null || !Number.isFinite(latencyMs)) return false;
  return latencyMs < (TIME_BUDGET_SECONDS[type] ?? 90) * 1000 * RAPID_GUESS_SHARE;
}

export interface CalibrationCandidate {
  responseId: number;
  type: string;
  latencyMs: number | null;
}

/**
 * Feeds logged answers into Elo item calibration (public.
 * calibrate_from_responses, which applies src/lib/calibration.ts eloStep
 * atomically per item). Only answers that carry real information about the
 * item are passed: the student's ability must already rest on
 * MIN_CALIBRATION_HISTORY answers, and rapid guesses are dropped. The SQL
 * enforces the rest (answered, non-review, first answer per student×item).
 */
export async function calibrateItems(
  supabase: SupabaseClient,
  ability: { theta: number; n: number },
  candidates: CalibrationCandidate[],
): Promise<{ updated: number; skipped: string | null; error: string | null }> {
  if (ability.n < MIN_CALIBRATION_HISTORY) {
    return { updated: 0, skipped: 'ability not yet established', error: null };
  }
  const ids = candidates.filter(c => !isRapidGuess(c.type, c.latencyMs)).map(c => c.responseId);
  if (ids.length === 0) return { updated: 0, skipped: 'no eligible answers', error: null };

  const { data, error } = await supabase.rpc('calibrate_from_responses', {
    p_response_ids: ids,
    p_theta: ability.theta,
    p_a: BASELINE_A,
    p_k0: ELO_K0,
    p_n0: ELO_N0,
  });
  if (error) return { updated: 0, skipped: null, error: error.message };
  return { updated: (data as number | null) ?? 0, skipped: null, error: null };
}
