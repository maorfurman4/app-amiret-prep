import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateThetaEAP, irtProbability, itemIrtParams } from '@/lib/adaptive';

/**
 * A student's current ability (θ), estimated from their own recent answers
 * across every surface — the responses log, not any single exam. EAP with
 * the N(0,1) prior, so a brand-new student starts at θ = 0 and the estimate
 * firms up as answers accumulate.
 */
export const ABILITY_WINDOW = 200;

/**
 * Ring A's "sweet spot": items the student is predicted to get right with
 * probability in this band are effortful but achievable — hard enough to
 * force retrieval, easy enough to succeed more often than not. Much easier
 * is rehearsal; much harder (near the 25% guessing floor) is noise.
 */
export const SWEET_SPOT = { min: 0.5, max: 0.85 } as const;

export function isInSweetSpot(pCorrect: number | null | undefined): boolean {
  return typeof pCorrect === 'number' && pCorrect >= SWEET_SPOT.min && pCorrect <= SWEET_SPOT.max;
}

export function predictCorrect(theta: number, item: { b: number; c?: number | null }): number {
  return irtProbability(theta, itemIrtParams(item));
}

export async function estimateOwnerTheta(
  supabase: SupabaseClient,
  owner: { id: string; type: 'user' | 'guest' },
): Promise<number> {
  const { data, error } = await supabase
    .from('responses')
    .select('correct, questions(b, c)')
    .eq('owner_type', owner.type)
    .eq('owner_id', owner.id)
    .not('chosen_option', 'is', null)
    .order('created_at', { ascending: false })
    .limit(ABILITY_WINDOW);
  if (error || !data) return 0;

  type Row = { correct: boolean; questions: { b: number; c: number | null } | null };
  const rows = (data as unknown as Row[]).filter(r => r.questions && Number.isFinite(r.questions.b));
  if (rows.length === 0) return 0;
  return estimateThetaEAP(
    rows.map(r => itemIrtParams(r.questions!)),
    rows.map(r => (r.correct ? 1 : 0)),
  );
}
