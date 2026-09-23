import type { SupabaseClient } from '@supabase/supabase-js';
import { BASELINE_A } from '@/lib/adaptive';
import { ELO_K0, ELO_N0, MIN_CALIBRATION_HISTORY } from '@/lib/calibration';
import { RAPID_GUESS_SHARE, TIME_BUDGET_SECONDS } from '@/lib/fsrs';

export interface CalibrationCandidate {
  responseId: number;
  type: string;
  latencyMs: number | null;
}

/** Answered faster than this share of the time budget → almost certainly a
 * guess (Wise & Kong, 2005): it says nothing about the item's difficulty. */
export function isRapidGuess(type: string, latencyMs: number | null): boolean {
  if (latencyMs === null || !Number.isFinite(latencyMs)) return false;
  return latencyMs < (TIME_BUDGET_SECONDS[type] ?? 90) * 1000 * RAPID_GUESS_SHARE;
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
