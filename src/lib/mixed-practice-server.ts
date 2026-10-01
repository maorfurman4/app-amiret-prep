/**
 * Data access for mixed-type practice (/api/practice/questions?type=mixed).
 *
 * Same cross-session guarantees as question-history.ts — unseen first, and a
 * type+level's history is reset once its pool is exhausted — but with the
 * lookups consolidated for a many-type session:
 * - the user's seen history is read ONCE, by user_key alone
 *   (fetchSeenQuestionIds, shared with the per-type helper);
 * - all chosen questions are fetched in one id batch instead of one per
 *   type × level;
 * - passage history is read once for every passage in the session.
 */
import type { createServerSupabaseClient } from '@/lib/supabase-server';
import type { DifficultyLevel, Question, QuestionType } from '@/types/exam';
import { pickDistinctOptions } from '@/lib/option-overlap';
import { buildRCQuestions, chunks, fetchSeenQuestionIds, ID_CHUNK } from '@/lib/question-history';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** Candidates drawn per question needed, so shared-choice questions can be skipped. */
const CANDIDATE_FACTOR = 6;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchByIds(supabase: SupabaseClient, ids: string[]): Promise<Map<string, Question>> {
  const pages = await Promise.all(chunks(ids, ID_CHUNK).map(part =>
    supabase.from('questions').select('*').in('id', part).then(({ data }) => (data ?? []) as Question[])));
  return new Map(pages.flat().map(q => [q.id, q]));
}

export interface SinglesRequest { type: QuestionType; needed: number }

/**
 * Picks `needed` unseen questions per requested type, spread across `levels`
 * (one level = a fixed difficulty; all five = "random"). Returns them per
 * type; a type comes back short only when its whole pool is.
 */
export async function fetchMixedSingles({
  supabase,
  userKey,
  requests,
  levels,
}: {
  supabase: SupabaseClient;
  userKey: string | null;
  requests: SinglesRequest[];
  levels: DifficultyLevel[];
}): Promise<Map<QuestionType, Question[]>> {
  const wanted = requests.filter(r => r.needed > 0);
  const result = new Map<QuestionType, Question[]>(requests.map(r => [r.type, []]));
  if (wanted.length === 0) return result;

  // Id lists stay per type × level: one pool is ~370–610 rows, but merged
  // they'd pass the 1000-row response cap and silently drop questions.
  const groups = wanted.flatMap(r => levels.map(level => ({ type: r.type, level, perLevel: Math.ceil(r.needed / levels.length) })));
  const [idLists, seen] = await Promise.all([
    Promise.all(groups.map(g => supabase
      .from('questions')
      .select('id')
      .eq('type', g.type)
      .eq('difficulty_level', g.level)
      .eq('active', true)
      .then(({ data }) => ((data ?? []) as { id: string }[]).map(r => r.id)))),
    userKey ? fetchSeenQuestionIds(supabase, userKey) : Promise.resolve(new Set<string>()),
  ]);

  // Per type × level: sample unseen ids, or — once fewer remain than this
  // level's share — the full pool, resetting that level's history (the same
  // rule as planUnseenQuestions).
  const resetIds: string[] = [];
  const candidates = groups.map((g, i) => {
    const all = idLists[i];
    const unseen = all.filter(id => !seen.has(id));
    const take = g.perLevel * CANDIDATE_FACTOR;
    if (unseen.length >= g.perLevel) return { type: g.type, ids: shuffle(unseen).slice(0, take) };
    if (all.some(id => seen.has(id))) resetIds.push(...all);
    return { type: g.type, ids: shuffle(all).slice(0, take) };
  });

  const byId = await fetchByIds(supabase, candidates.flatMap(c => c.ids));
  for (const r of wanted) {
    const pool = shuffle(candidates.filter(c => c.type === r.type).flatMap(c => c.ids))
      .map(id => byId.get(id))
      .filter((q): q is Question => !!q);
    result.set(r.type, pickDistinctOptions(pool, r.needed));
  }

  if (userKey && resetIds.length > 0) {
    await Promise.all(chunks(resetIds, ID_CHUNK).map(part => supabase
      .from('user_question_history')
      .delete()
      .eq('user_key', userKey)
      .in('question_id', part)));
  }
  return result;
}

type PassageRow = { id: string; text: string; difficulty_level: number; b: number };

async function queryPassages(supabase: SupabaseClient, level: number, excludeIds: string[]): Promise<PassageRow[]> {
  let q = supabase
    .from('passages')
    .select('id, text, difficulty_level, b')
    .eq('difficulty_level', level)
    .eq('active', true)
    .limit(20);
  if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`);
  const { data } = await q;
  return (data ?? []) as PassageRow[];
}

/**
 * One distinct, unseen passage per entry of `levels` (repeat a level to get
 * several at it), each returned as its own block of questions in stored
 * order. Passage history is read once; if a level has no unseen passage
 * left, the user's passage history is reset (as fetchUnseenRCQuestions does).
 */
export async function fetchMixedPassages({
  supabase,
  userKey,
  levels,
}: {
  supabase: SupabaseClient;
  userKey: string | null;
  levels: DifficultyLevel[];
}): Promise<Question[][]> {
  if (levels.length === 0) return [];

  let seen: string[] = [];
  if (userKey) {
    const { data } = await supabase.from('user_passage_history').select('passage_id').eq('user_key', userKey);
    seen = ((data ?? []) as { passage_id: string }[]).map(r => r.passage_id);
  }

  const needByLevel = new Map<DifficultyLevel, number>();
  for (const lv of levels) needByLevel.set(lv, (needByLevel.get(lv) ?? 0) + 1);

  let resetHistory = false;
  const picked = (await Promise.all([...needByLevel].map(async ([level, need]) => {
    let pool = shuffle(await queryPassages(supabase, level, seen));
    if (pool.length < need && userKey && seen.length > 0) {
      resetHistory = true;
      pool = shuffle(await queryPassages(supabase, level, []));
    }
    return pool.slice(0, need);
  }))).flat();

  if (resetHistory && userKey) {
    await supabase.from('user_passage_history').delete().eq('user_key', userKey);
  }

  const blocks = await Promise.all(picked.map(p => buildRCQuestions(supabase, p)));
  return shuffle(blocks.filter(b => b.length > 0));
}
