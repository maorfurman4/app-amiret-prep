import type { SupabaseClient } from '@supabase/supabase-js';
import { SWEET_SPOT } from '@/lib/ability';
import { localDayStart, localWeekStart } from '@/lib/date-local';

/**
 * The three daily rings, each read straight from server-verified learning
 * data — nothing here is a counter the client can increment.
 *
 *   effort     Ring A — practice/diagnostic questions answered today whose
 *              predicted P(correct) (responses.p_correct, set server-side at
 *              answer time) fell in the sweet spot [0.5, 0.85]. Volume on
 *              items that are too easy or hopeless doesn't count.
 *   retention  Ring B — FSRS reviews completed today of cards that were
 *              actually due (srs_review_log.was_due, decided server-side),
 *              against what's still due right now.
 *   simulation Ring C — a completed, timed full exam since the start of
 *              this (Israeli, Sunday-first) week.
 */
export const DEFAULT_EFFORT_TARGET = 15;

export interface Rings {
  effort: { done: number; target: number };
  retention: { done: number; due: number };
  simulation: { done: boolean };
}

export interface RingProgress {
  effort: number;
  retention: number;
  simulation: number;
}

/**
 * Fill ratio (0..1) per ring. Retention is complete when nothing is left
 * due — an empty queue is settled, not an invented obligation.
 */
export function ringProgress(r: Rings): RingProgress {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const retentionTarget = r.retention.done + r.retention.due;
  return {
    effort: clamp(r.effort.done / Math.max(1, r.effort.target)),
    retention: retentionTarget > 0 ? clamp(r.retention.done / retentionTarget) : 1,
    simulation: r.simulation.done ? 1 : 0,
  };
}

export async function computeRings(
  supabase: SupabaseClient,
  owner: { id: string; type: 'user' | 'guest' },
  { effortTarget = DEFAULT_EFFORT_TARGET, dueNow, now = new Date() }: { effortTarget?: number; dueNow: number; now?: Date },
): Promise<Rings> {
  const dayStart = localDayStart(now).toISOString();
  const weekStart = localWeekStart(now).toISOString();

  const [effortRes, retentionRes, simRes] = await Promise.all([
    supabase
      .from('responses')
      .select('id', { count: 'exact', head: true })
      .eq('owner_type', owner.type)
      .eq('owner_id', owner.id)
      .in('context', ['practice', 'diagnostic'])
      .not('chosen_option', 'is', null)
      .gte('p_correct', SWEET_SPOT.min)
      .lte('p_correct', SWEET_SPOT.max)
      .gte('created_at', dayStart),
    supabase
      .from('srs_review_log')
      .select('id', { count: 'exact', head: true })
      .eq('owner_type', owner.type)
      .eq('owner_id', owner.id)
      .eq('was_due', true)
      .eq('answered', true)
      .gte('reviewed_at', dayStart),
    supabase
      .from('exam_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', owner.id)
      .eq('is_practice', false)
      .not('score', 'is', null)
      .gte('completed_at', weekStart),
  ]);

  return {
    effort: { done: effortRes.count ?? 0, target: effortTarget },
    retention: { done: retentionRes.count ?? 0, due: dueNow },
    simulation: { done: (simRes.count ?? 0) > 0 },
  };
}
