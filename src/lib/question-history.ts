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

/**
 * A pool read failed (DB or network down). Thrown instead of returning an
 * empty list, so a route answers 503 rather than "no questions left" — and
 * so a failed passage query is never taken for "all seen" and resets history.
 */
export class PoolUnavailableError extends Error {
  constructor(detail: string) {
    super(`question pool unavailable: ${detail}`);
    this.name = 'PoolUnavailableError';
  }
}

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
  // A whole type+level pool (~370–610 ids) is too long for one request URL,
  // so the reset is deleted in chunks.
  await Promise.all(chunks(plan.resetQuestionIds, ID_CHUNK).map(part => supabase
    .from('user_question_history')
    .delete()
    .eq('user_key', userKey)
    .in('question_id', part)));
  return plan.questions;
}

/** PostgREST's default max rows per response. */
const PAGE = 1000;
/** Ids per `.in()` request, to keep request URLs short. */
export const ID_CHUNK = 100;

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Every question id this user has seen, read by user_key alone and paged past
 * the 1000-row cap. Filtering a type+level pool against it happens in memory:
 * passing the pool's ~500 ids to `.in('question_id', …)` makes a request too
 * long to succeed — it fails after ~10s and dedup is silently skipped.
 */
export async function fetchSeenQuestionIds(supabase: SupabaseClient, userKey: string): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_question_history')
      .select('question_id')
      .eq('user_key', userKey)
      .order('question_id')
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data as { question_id: string }[]) seen.add(r.question_id);
    if (data.length < PAGE) break;
  }
  return seen;
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
  const [{ data: allQsOfTypeDiff, error: poolErr }, seenByUser] = await Promise.all([
    supabase
      .from('questions')
      .select('id')
      .eq('type', type)
      .eq('difficulty_level', difficultyLevel)
      .eq('active', true),
    fetchSeenQuestionIds(supabase, userKey),
  ]);
  // A failed read must not look like an empty pool — see PoolUnavailableError.
  if (poolErr) throw new PoolUnavailableError(poolErr.message);
  const typeDiffIds = (allQsOfTypeDiff ?? []).map((r: { id: string }) => r.id);
  const seenIds = typeDiffIds.filter(id => seenByUser.has(id));

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
  const { data, error } = await supabase.from('questions').select('*').in('id', ids);
  if (error) throw new PoolUnavailableError(error.message);
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
 * Once every passage at this difficulty has been seen, that level's history
 * (and only that level's) is reset and a passage is drawn from the full level.
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
  if (userKey) await deletePassageHistory(supabase, userKey, plan.resetPassageIds);
  return plan.questions;
}

/** Read-only RC selection plan: the passage to serve, and which history to reset. */
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
}): Promise<{ questions: Question[]; resetPassageIds: string[] }> {
  // Filtered in memory, like planUnseenQuestions: sending every seen
  // passage as a `not.in` list made the request URL too long to succeed.
  const [levelIds, seen] = await Promise.all([
    fetchLevelPassageIds(supabase, difficultyLevel),
    userKey ? fetchSeenPassageIds(supabase, userKey) : Promise.resolve(new Set<string>()),
  ]);
  const used = new Set(usedPIds);
  const available = levelIds.filter(id => !used.has(id));
  const unseen = available.filter(id => !seen.has(id));
  if (unseen.length > 0) {
    return { questions: await rcQuestionsFor(supabase, sample(unseen, 1)[0]), resetPassageIds: [] };
  }
  if (available.length === 0) return { questions: [], resetPassageIds: [] };
  // Every passage at this level seen: reset this level only (keep in-session exclusions).
  const resetPassageIds = levelIds.some(id => seen.has(id)) ? levelIds : [];
  return { questions: await rcQuestionsFor(supabase, sample(available, 1)[0]), resetPassageIds };
}

/** Ids of the active passages at one level (~100) — ids only, so the list stays small. */
export async function fetchLevelPassageIds(supabase: SupabaseClient, difficultyLevel: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('passages')
    .select('id')
    .eq('difficulty_level', difficultyLevel)
    .eq('active', true);
  // Read as "every passage seen", a failed query would reset the history.
  if (error) throw new PoolUnavailableError(error.message);
  return ((data ?? []) as { id: string }[]).map(r => r.id);
}

/** Every passage id this user has seen, read by user_key alone and paged. */
export async function fetchSeenPassageIds(supabase: SupabaseClient, userKey: string): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_passage_history')
      .select('passage_id')
      .eq('user_key', userKey)
      .order('passage_id')
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data as { passage_id: string }[]) seen.add(r.passage_id);
    if (data.length < PAGE) break;
  }
  return seen;
}

/** Passage rows for these ids (a handful), in no particular order. */
export async function fetchPassageRows(supabase: SupabaseClient, ids: string[]): Promise<PassageRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('passages').select('id, text, difficulty_level, b').in('id', ids);
  if (error) throw new PoolUnavailableError(error.message);
  return (data ?? []) as PassageRow[];
}

/** Clears these passages from one user's history, in chunks short enough for a URL. */
export async function deletePassageHistory(supabase: SupabaseClient, userKey: string, passageIds: string[]): Promise<void> {
  await Promise.all(chunks(passageIds, ID_CHUNK).map(part => supabase
    .from('user_passage_history')
    .delete()
    .eq('user_key', userKey)
    .in('passage_id', part)));
}

type PassageRow = { id: string; text: string; difficulty_level: number; b: number };

async function rcQuestionsFor(supabase: SupabaseClient, passageId: string): Promise<Question[]> {
  const [passage] = await fetchPassageRows(supabase, [passageId]);
  return passage ? buildRCQuestions(supabase, passage) : [];
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
