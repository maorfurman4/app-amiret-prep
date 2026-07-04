/**
 * Cross-session question/passage deduplication helpers.
 *
 * Guarantees users never see the same question (or RC passage) twice until
 * they've exhausted the full pool for that type. After exhaustion the history
 * is reset and questions appear in a fresh random order.
 */
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Question } from '@/types/exam';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// ── Question helpers ──────────────────────────────────────────────────────────

/**
 * Fetches `needed` unseen questions of `type` at `difficultyLevel` for `userKey`.
 * If fewer than `needed` unseen questions remain, resets history for that type
 * and selects from the full pool.
 */
export async function fetchUnseenQuestions({
  supabase,
  userKey,
  type,
  difficultyLevel,
  needed,
}: {
  supabase: SupabaseClient;
  userKey: string;
  type: string;
  difficultyLevel: number;
  needed: number;
}): Promise<Question[]> {
  // Get IDs already seen by this user for this type+difficulty combination only
  // (scoped to difficulty so reset doesn't wipe other difficulty levels)
  const { data: allQsOfTypeDiff } = await supabase
    .from('questions')
    .select('id')
    .eq('type', type)
    .eq('difficulty_level', difficultyLevel)
    .eq('active', true);
  const typeDiffIds = (allQsOfTypeDiff ?? []).map((r: { id: string }) => r.id);

  let seenIds: string[] = [];
  if (typeDiffIds.length > 0) {
    const { data: seenRows } = await supabase
      .from('user_question_history')
      .select('question_id')
      .eq('user_key', userKey)
      .in('question_id', typeDiffIds);
    seenIds = (seenRows ?? []).map((r: { question_id: string }) => r.question_id);
  }

  // Try to fetch unseen questions at target difficulty
  let questions = await queryQuestions(supabase, type, difficultyLevel, needed, seenIds);

  if (questions.length >= needed) {
    return questions.slice(0, needed);
  }

  // Not enough unseen → reset history for this type+difficulty only (not cross-difficulty)
  if (seenIds.length > 0) {
    await supabase
      .from('user_question_history')
      .delete()
      .eq('user_key', userKey)
      .in('question_id', typeDiffIds);
  }

  questions = await queryQuestions(supabase, type, difficultyLevel, needed, []);
  return questions.slice(0, needed);
}

async function queryQuestions(
  supabase: SupabaseClient,
  type: string,
  difficultyLevel: number,
  limit: number,
  excludeIds: string[],
): Promise<Question[]> {
  let query = supabase
    .from('questions')
    .select('*')
    .eq('type', type)
    .eq('difficulty_level', difficultyLevel)
    .eq('active', true)
    .limit(limit + 10);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await query;
  const arr = [...((data ?? []) as Question[])];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Marks question IDs as seen in the cross-session history.
 * Safe to call multiple times — duplicates are silently ignored.
 */
export async function recordSeenQuestions(
  supabase: SupabaseClient,
  userKey: string,
  questionIds: string[],
): Promise<void> {
  if (questionIds.length === 0) return;
  await supabase
    .from('user_question_history')
    .upsert(
      questionIds.map(qid => ({ user_key: userKey, question_id: qid })),
      { onConflict: 'user_key,question_id', ignoreDuplicates: true },
    );
}

// ── RC passage helpers ────────────────────────────────────────────────────────

/**
 * Fetches RC questions from an unseen passage.
 * `usedPIds` = passage IDs already used in the current session.
 * Cross-session seen passages are also excluded.
 * Resets passage history for the user if all passages at this difficulty
 * have been seen, then retries.
 */
export async function fetchUnseenRCQuestions({
  supabase,
  userKey,
  difficultyLevel,
  usedPIds,
}: {
  supabase: SupabaseClient;
  userKey: string | null;
  difficultyLevel: number;
  usedPIds: string[];
}): Promise<Question[]> {
  let excludePassageIds = [...usedPIds];

  if (userKey) {
    const { data: seenPassages } = await supabase
      .from('user_passage_history')
      .select('passage_id')
      .eq('user_key', userKey);
    const crossSessionIds = (seenPassages ?? []).map((r: { passage_id: string }) => r.passage_id);
    excludePassageIds = [...new Set([...excludePassageIds, ...crossSessionIds])];
  }

  const passage = await queryPassage(supabase, difficultyLevel, excludePassageIds);

  if (!passage && userKey) {
    // All passages seen — reset cross-session history and retry (keep in-session exclusions)
    await supabase
      .from('user_passage_history')
      .delete()
      .eq('user_key', userKey);

    const freshPassage = await queryPassage(supabase, difficultyLevel, usedPIds);
    if (freshPassage) {
      return buildRCQuestions(supabase, freshPassage);
    }
    return [];
  }

  if (!passage) return [];
  return buildRCQuestions(supabase, passage);
}

async function queryPassage(
  supabase: SupabaseClient,
  difficultyLevel: number,
  excludeIds: string[],
) {
  let q = supabase
    .from('passages')
    .select('id, text, difficulty_level, b')
    .eq('difficulty_level', difficultyLevel)
    .eq('active', true)
    .limit(20);
  if (excludeIds.length > 0) {
    q = q.not('id', 'in', `(${excludeIds.join(',')})`);
  }
  const { data: passages } = await q;
  if (!passages || passages.length === 0) return null;
  return passages[Math.floor(Math.random() * passages.length)];
}

async function buildRCQuestions(
  supabase: SupabaseClient,
  passage: { id: string; text: string; difficulty_level: number; b: number },
): Promise<Question[]> {
  const { data: qs } = await supabase
    .from('questions')
    .select('*')
    .eq('type', 'reading_comprehension')
    .eq('passage_id', passage.id)
    .limit(5);

  return (qs ?? []).map(q => ({
    ...q,
    passage: { id: passage.id, text: passage.text, difficulty_level: passage.difficulty_level, b: passage.b },
  })) as Question[];
}

/**
 * Records a passage as seen in the cross-session history.
 */
export async function recordSeenPassage(
  supabase: SupabaseClient,
  userKey: string,
  passageId: string,
): Promise<void> {
  await supabase
    .from('user_passage_history')
    .upsert(
      [{ user_key: userKey, passage_id: passageId }],
      { onConflict: 'user_key,passage_id', ignoreDuplicates: true },
    );
}
