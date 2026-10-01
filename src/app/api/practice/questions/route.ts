import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import type { Question, QuestionType, DifficultyLevel } from '@/types/exam';
import { pickDistinctOptions } from '@/lib/option-overlap';
import { fetchUnseenQuestions, recordSeenQuestions, fetchUnseenRCQuestions, recordSeenPassage } from '@/lib/question-history';
import { shuffleAllOptions } from '@/lib/option-shuffle';
import { interleaveMixed, parseMixedPlan, MIXED_TYPE, type MixedPlan } from '@/lib/mixed-practice';
import { fetchMixedSingles, fetchMixedPassages } from '@/lib/mixed-practice-server';

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * GET /api/practice/questions
 * Returns a set of questions for focused section practice.
 * No session created — stateless, client manages progress.
 *
 * Uses user_question_history / user_passage_history (same helpers as the
 * exam flow) so a user never sees the same question/passage twice across
 * practice sessions until the full pool for that type+difficulty is
 * exhausted, at which point history resets and questions cycle again.
 *
 * Query params:
 *   type     — sentence_completion | restatement | reading_comprehension | mixed
 *     "mixed" serves sc sentence-completion + rs restatement questions + rc
 *     whole reading passages, interleaved (see interleaveMixed in
 *     src/lib/mixed-practice.ts: each passage stays one contiguous block).
 *     Its response also carries `mix: { requested, served }` so the client
 *     can tell the student when a pool ran short.
 *   sc, rs, rc — mixed only: counts per type (rc in passages), clamped to
 *     MIXED_LIMITS; all absent → MIXED_DEFAULT; empty or over the cap → 400.
 *   difficulty — 1-5 | "random"
 *   count    — 5 | 10 (ignored for reading_comprehension, always returns 5;
 *     ignored for mixed, which uses sc/rs/rc)
 *   guestId  — localStorage guest UUID, used when there is no authenticated user
 *   deferSeen — "1" to skip marking the returned questions as seen here.
 *     For callers (like the diagnostic) that intentionally over-fetch more
 *     candidates than they'll actually show, so the unused candidates don't
 *     get burned from the pool — the caller must then POST the subset it
 *     actually used to /api/practice/questions/mark-seen itself.
 *
 * Every returned question has its options freshly shuffled (see
 * src/lib/option-shuffle.ts) — `option_order` maps each displayed option
 * back to its stored index for response logging.
 */
export async function GET(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();

  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') as QuestionType | 'mixed' | null;
  const diffParam = searchParams.get('difficulty') ?? 'random';
  const countParam = parseInt(searchParams.get('count') ?? '5', 10);
  const deferSeen = searchParams.get('deferSeen') === '1';
  const userKey = user?.id ?? guestId ?? null;

  if (!type || !['sentence_completion', 'restatement', 'reading_comprehension', 'mixed'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const count = [5, 10].includes(countParam) ? countParam : 5;

  const difficulty: DifficultyLevel = diffParam === 'random'
    ? (Math.ceil(Math.random() * 5) as DifficultyLevel)
    : (Math.max(1, Math.min(5, parseInt(diffParam, 10))) as DifficultyLevel);

  if (type === 'mixed') {
    const plan = parseMixedPlan(searchParams);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid mix' }, { status: 400 });
    }

    // "random" spreads the singles across all 5 levels and gives each
    // passage (an indivisible block at one level) its own random level,
    // rather than pinning the whole session to the one draw above.
    const random = diffParam === 'random';
    const randomLevel = () => Math.ceil(Math.random() * 5) as DifficultyLevel;
    const [singles, passages] = await Promise.all([
      fetchMixedSingles({
        supabase,
        userKey,
        requests: [
          { type: MIXED_TYPE.sc, needed: plan.sc },
          { type: MIXED_TYPE.rs, needed: plan.rs },
        ],
        levels: random ? [1, 2, 3, 4, 5] : [difficulty],
      }),
      fetchMixedPassages({
        supabase,
        userKey,
        levels: Array.from({ length: plan.rc }, () => (random ? randomLevel() : difficulty)),
      }),
    ]);
    const sc = singles.get(MIXED_TYPE.sc) ?? [];
    const rs = singles.get(MIXED_TYPE.rs) ?? [];

    const questions = interleaveMixed(sc, rs, passages);
    if (!questions.length) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 });
    }
    if (userKey && !deferSeen) {
      if (sc.length + rs.length > 0) await recordSeenQuestions(supabase, userKey, [...sc, ...rs].map(q => q.id));
      for (const block of passages) await recordSeenPassage(supabase, userKey, block[0].passage_id!);
    }
    // What was asked for vs. what the pools could fill, so the client can
    // say so when a session comes back short instead of silently shrinking.
    const served: MixedPlan = { sc: sc.length, rs: rs.length, rc: passages.length };
    return NextResponse.json({
      questions: shuffleAllOptions(questions),
      difficulty: random ? 'random' : difficulty,
      mix: { requested: plan, served },
    });
  }

  if (type === 'reading_comprehension') {
    // `difficulty` already resolves a concrete 1-5 level even in random mode (see above).
    const questions = await fetchUnseenRCQuestions({ supabase, userKey, difficultyLevel: difficulty, usedPIds: [] });

    if (!questions.length) {
      return NextResponse.json({ error: 'No passages found for this difficulty' }, { status: 404 });
    }
    if (userKey && !deferSeen) await recordSeenPassage(supabase, userKey, questions[0].passage_id!);
    return NextResponse.json({ questions: shuffleAllOptions(questions), difficulty: questions[0].passage?.difficulty_level ?? difficulty });
  }

  // sentence_completion or restatement
  if (diffParam === 'random') {
    // Random mode: fetch unseen questions from ALL difficulty levels and mix them
    const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
    const perLevel = Math.ceil((count * 2) / 5); // fetch extra per level then trim
    const fetches = await Promise.all(
      LEVELS.map(lv => userKey
        ? fetchUnseenQuestions({ supabase, userKey, type, difficultyLevel: lv, needed: perLevel })
        : fetchRandomQuestionsNoHistory(supabase, type, lv, perLevel))
    );
    const pool = fetches.flat();
    if (!pool.length) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 });
    }
    const questions = pickDistinctOptions(fisherYates(pool), count);
    if (userKey && !deferSeen) await recordSeenQuestions(supabase, userKey, questions.map(q => q.id));
    return NextResponse.json({ questions: shuffleAllOptions(questions), difficulty: 'random' });
  }

  const questions = userKey
    ? await fetchUnseenQuestions({ supabase, userKey, type, difficultyLevel: difficulty, needed: count })
    : await fetchRandomQuestionsNoHistory(supabase, type, difficulty, count);

  if (!questions.length) {
    return NextResponse.json({ error: 'No questions found for this difficulty' }, { status: 404 });
  }
  if (userKey && !deferSeen) await recordSeenQuestions(supabase, userKey, questions.map(q => q.id));

  return NextResponse.json({ questions: shuffleAllOptions(questions), difficulty });
}

// Fallback used only when no auth user AND no guestId is present (e.g. localStorage
// blocked) — no cross-session identity to key history off of, so just shuffle the pool.
async function fetchRandomQuestionsNoHistory(
  supabase: Awaited<ReturnType<typeof getServerClients>>['supabase'],
  type: QuestionType,
  difficultyLevel: DifficultyLevel,
  needed: number,
): Promise<Question[]> {
  // All matching ids, sampled at random (a plain limit returns one
  // generation batch in storage order), then no shared answer choices.
  const { data: ids } = await supabase
    .from('questions')
    .select('id')
    .eq('type', type)
    .eq('difficulty_level', difficultyLevel)
    .eq('active', true);
  const picked = fisherYates(((ids ?? []) as { id: string }[]).map(r => r.id)).slice(0, needed * 6);
  if (picked.length === 0) return [];
  const { data } = await supabase.from('questions').select('*').in('id', picked);
  return pickDistinctOptions(fisherYates((data ?? []) as Question[]), needed);
}
