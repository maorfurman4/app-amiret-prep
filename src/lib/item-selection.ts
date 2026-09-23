import type { SupabaseClient } from '@supabase/supabase-js';
import type { Question } from '@/types/exam';
import { BASELINE_A } from '@/lib/adaptive';
import { buildRCQuestions } from '@/lib/question-history';

/**
 * Information-based item selection for the adaptive exam: instead of
 * routing to a difficulty *level*, each section takes the items that
 * carry the most Fisher information at a target θ (the student's ability,
 * or the cut score in decision sections — see chooseRouteTarget), using
 * the calibrated difficulties. Exposure control is randomesque: the draw is
 * random among the top RANDOMESQUE_FACTOR × needed items, so two students at
 * the same θ don't get identical sections. The SQL is in migration
 * 20260923200000 (pick_informative_items / pick_informative_passage).
 */
export const RANDOMESQUE_FACTOR = 3;
/** Passages are drawn from the top few by summed information. */
export const PASSAGE_POOL = 5;

export async function planInformativeQuestions({
  supabase, userKey, type, theta, needed, excludeIds = [],
}: {
  supabase: SupabaseClient;
  userKey: string;
  type: string;
  theta: number;
  needed: number;
  excludeIds?: string[];
}): Promise<Question[]> {
  const { data: picks, error } = await supabase.rpc('pick_informative_items', {
    p_type: type,
    p_theta: theta,
    p_a: BASELINE_A,
    p_needed: needed,
    p_user_key: userKey,
    p_exclude: excludeIds,
    p_pool: needed * RANDOMESQUE_FACTOR,
  });
  if (error || !picks) return [];
  const ids = (picks as { question_id: string }[]).map(p => p.question_id);
  if (ids.length === 0) return [];

  const { data: rows } = await supabase.from('questions').select('*').in('id', ids);
  const byId = new Map(((rows ?? []) as Question[]).map(q => [q.id, q]));
  return ids.map(id => byId.get(id)).filter((q): q is Question => !!q);
}

export async function planInformativePassage({
  supabase, userKey, theta, excludePassageIds = [],
}: {
  supabase: SupabaseClient;
  userKey: string;
  theta: number;
  excludePassageIds?: string[];
}): Promise<Question[]> {
  const { data: passageId, error } = await supabase.rpc('pick_informative_passage', {
    p_theta: theta,
    p_a: BASELINE_A,
    p_user_key: userKey,
    p_exclude: excludePassageIds,
    p_pool: PASSAGE_POOL,
  });
  if (error || !passageId) return [];
  const { data: passage } = await supabase
    .from('passages')
    .select('id, text, difficulty_level, b')
    .eq('id', passageId as string)
    .maybeSingle();
  if (!passage) return [];
  return buildRCQuestions(supabase as never, passage as { id: string; text: string; difficulty_level: number; b: number });
}
