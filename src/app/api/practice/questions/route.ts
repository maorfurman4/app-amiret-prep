import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import type { Question, QuestionType, DifficultyLevel } from '@/types/exam';
import { fetchUnseenQuestions, recordSeenQuestions, fetchUnseenRCQuestions, recordSeenPassage } from '@/lib/question-history';

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
 *     "mixed" interleaves sentence_completion + restatement (split evenly),
 *     folding in one full reading_comprehension passage as well once the
 *     session is long enough (count >= 8) to hold it without dominating the
 *     mix — real interleaved practice across question types, not just
 *     difficulty levels within one type.
 *   difficulty — 1-5 | "random"
 *   count    — 5 | 10 (ignored for reading_comprehension, always returns 5)
 *   guestId  — localStorage guest UUID, used when there is no authenticated user
 *   deferSeen — "1" to skip marking the returned questions as seen here.
 *     For callers (like the diagnostic) that intentionally over-fetch more
 *     candidates than they'll actually show, so the unused candidates don't
 *     get burned from the pool — the caller must then POST the subset it
 *     actually used to /api/practice/questions/mark-seen itself.
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
    const INTERLEAVE_TYPES: QuestionType[] = ['sentence_completion', 'restatement'];
    const includeRC = count >= 8;
    const simpleBudget = includeRC ? Math.max(1, count - 5) : count;
    const perType = Math.ceil(simpleBudget / INTERLEAVE_TYPES.length);

    const simpleFetches = await Promise.all(
      INTERLEAVE_TYPES.map(t => userKey
        ? fetchUnseenQuestions({ supabase, userKey, type: t, difficultyLevel: difficulty, needed: perType })
        : fetchRandomQuestionsNoHistory(supabase, t, difficulty, perType))
    );
    const simpleShuffled = fisherYates(simpleFetches.flat()).slice(0, simpleBudget);

    let rcBlock: Question[] = [];
    if (includeRC) {
      rcBlock = await fetchUnseenRCQuestions({ supabase, userKey, difficultyLevel: difficulty, usedPIds: [] });
    }

    const questions = fisherYates([...simpleShuffled, ...rcBlock]);
    if (!questions.length) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 });
    }
    if (userKey && !deferSeen) {
      if (simpleShuffled.length > 0) await recordSeenQuestions(supabase, userKey, simpleShuffled.map(q => q.id));
      if (rcBlock.length > 0) await recordSeenPassage(supabase, userKey, rcBlock[0].passage_id!);
    }
    return NextResponse.json({ questions, difficulty });
  }

  if (type === 'reading_comprehension') {
    // `difficulty` already resolves a concrete 1-5 level even in random mode (see above).
    const questions = await fetchUnseenRCQuestions({ supabase, userKey, difficultyLevel: difficulty, usedPIds: [] });

    if (!questions.length) {
      return NextResponse.json({ error: 'No passages found for this difficulty' }, { status: 404 });
    }
    if (userKey && !deferSeen) await recordSeenPassage(supabase, userKey, questions[0].passage_id!);
    return NextResponse.json({ questions, difficulty: questions[0].passage?.difficulty_level ?? difficulty });
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
    const questions = fisherYates(pool).slice(0, count);
    if (userKey && !deferSeen) await recordSeenQuestions(supabase, userKey, questions.map(q => q.id));
    return NextResponse.json({ questions, difficulty: 'random' });
  }

  const questions = userKey
    ? await fetchUnseenQuestions({ supabase, userKey, type, difficultyLevel: difficulty, needed: count })
    : await fetchRandomQuestionsNoHistory(supabase, type, difficulty, count);

  if (!questions.length) {
    return NextResponse.json({ error: 'No questions found for this difficulty' }, { status: 404 });
  }
  if (userKey && !deferSeen) await recordSeenQuestions(supabase, userKey, questions.map(q => q.id));

  return NextResponse.json({ questions, difficulty });
}

// Fallback used only when no auth user AND no guestId is present (e.g. localStorage
// blocked) — no cross-session identity to key history off of, so just shuffle the pool.
async function fetchRandomQuestionsNoHistory(
  supabase: Awaited<ReturnType<typeof getServerClients>>['supabase'],
  type: QuestionType,
  difficultyLevel: DifficultyLevel,
  needed: number,
): Promise<Question[]> {
  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('type', type)
    .eq('difficulty_level', difficultyLevel)
    .eq('active', true)
    .limit(needed + 10);
  return fisherYates((data ?? []) as Question[]).slice(0, needed);
}
