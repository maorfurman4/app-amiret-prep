/**
 * Cross-session question/passage deduplication helpers.
 *
 * Guarantees users never see the same question (or RC passage) twice until
 * they've exhausted the full pool for that type. After exhaustion the history
 * is reset and questions appear in a fresh random order.
 */
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Question } from '@/types/exam';
import { pickDistinctOptions } from '@/lib/option-overlap';

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
  const plan = await planUnseenQuestions({ supabase, userKey, type, difficultyLevel, needed });
  if (plan.resetQuestionIds.length > 0) {
    await supabase
      .from('user_question_history')
      .delete()
      .eq('user_key', userKey)
      .in('question_id', plan.resetQuestionIds);
  }
  return plan.questions;
}

/** Read-only selection plan for an atomic exam transition. */
export async function planUnseenQuestions({
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
}): Promise<{ questions: Question[]; resetQuestionIds: string[] }> {
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

  // Sample the candidates at random from ALL matching ids — a plain
  // `limit` returns rows in storage order, i.e. the same generation batch
  // every time — then keep the set free of shared answer choices.
  const seen = new Set(seenIds);
  const unseenIds = typeDiffIds.filter(id => !seen.has(id));
  if (unseenIds.length >= needed) {
    const pool = await fetchByIds(supabase, sample(unseenIds, needed * CANDIDATE_FACTOR));
    return { questions: pickDistinctOptions(pool, needed), resetQuestionIds: [] };
  }

  const pool = await fetchByIds(supabase, sample(typeDiffIds, needed * CANDIDATE_FACTOR));
  return { questions: pickDistinctOptions(pool, needed), resetQuestionIds: seenIds.length > 0 ? typeDiffIds : [] };
}

/** Candidates drawn per question needed, so shared-choice questions can be skipped. */
const CANDIDATE_FACTOR = 6;

function sample<T>(items: T[], n: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/** Rows for these ids, in the (already random) order of the ids. */
async function fetchByIds(supabase: SupabaseClient, ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from('questions').select('*').in('id', ids);
  const byId = new Map(((data ?? []) as Question[]).map(q => [q.id, q]));
  return ids.map(id => byId.get(id)).filter((q): q is Question => !!q);
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
  const plan = await planUnseenRCQuestions({ supabase, userKey, difficultyLevel, usedPIds });
  if (plan.resetPassageHistory && userKey) {
    await supabase.from('user_passage_history').delete().eq('user_key', userKey);
  }
  return plan.questions;
}

/** Read-only RC selection plan for an atomic exam transition. */
export async function planUnseenRCQuestions({
  supabase,
  userKey,
  difficultyLevel,
  usedPIds,
}: {
  supabase: SupabaseClient;
  userKey: string | null;
  difficultyLevel: number;
  usedPIds: string[];
}): Promise<{ questions: Question[]; resetPassageHistory: boolean }> {
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
    const freshPassage = await queryPassage(supabase, difficultyLevel, usedPIds);
    if (freshPassage) {
      return { questions: await buildRCQuestions(supabase, freshPassage), resetPassageHistory: true };
    }
    return { questions: [], resetPassageHistory: true };
  }

  if (!passage) return { questions: [], resetPassageHistory: false };
  return { questions: await buildRCQuestions(supabase, passage), resetPassageHistory: false };
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

export async function buildRCQuestions(
  supabase: SupabaseClient,
  passage: { id: string; text: string; difficulty_level: number; b: number },
  // The exam also leaves out exam-excluded questions; practice keeps them.
  { examOnly = false }: { examOnly?: boolean } = {},
): Promise<Question[]> {
  let q = supabase
    .from('questions')
    .select('*')
    .eq('type', 'reading_comprehension')
    .eq('passage_id', passage.id)
    .eq('active', true);
  if (examOnly) q = q.eq('exam_eligible', true);
  const { data: qs } = await q.order('id').limit(5);

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
