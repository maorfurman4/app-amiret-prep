import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { computeWeakestType } from '@/lib/weakness';
import { fetchUnseenQuestions, fetchUnseenRCQuestions } from '@/lib/question-history';
import { shuffleAllOptions } from '@/lib/option-shuffle';
import { selectDueReviewQuestions } from '@/lib/srs';
import type { Question, QuestionType } from '@/types/exam';

const REVIEW_LIMIT = 8;
const WEAK_PRACTICE_COUNT = 5;
const VOCAB_LIMIT = 8;

interface VocabWord {
  id: string;
  word: string;
  definition: string;
  hebrew_translation: string;
  example_sentence: string;
  category: string;
  difficulty_level: number;
  interval_days: number;
}

/**
 * GET /api/today-session
 * Blends everything that's actually due into one default session, instead
 * of making the student choose between five separate entry points (review
 * queue, vocabulary, focused practice by type+difficulty+count, diagnostic,
 * full simulation) before answering a single question:
 *   1. Due spaced-review concepts, each served as a sibling question when
 *      one exists (see src/lib/srs.ts)
 *   2. Due vocabulary words (known words up for spaced review) — signed-in
 *      users only; guest vocab progress is localStorage-only (see
 *      user_vocab_known's FK to auth.users in src/lib/guest.ts), so there's
 *      nothing for the server to query for a guest.
 *   3. Fresh questions at the student's diagnosed weakest type+level, from
 *      their last (up to) 10 completed exams — same detection stats/page.tsx
 *      already uses for its one-tap "practice your weakness" CTA.
 * Weak-area questions are intentionally NOT marked "seen" here — the
 * client calls /api/practice/questions/mark-seen once it actually reaches
 * that part of the session, the same defer-then-confirm pattern the
 * diagnostic uses, so a student who loads this and never starts doesn't
 * burn questions from their own future pool for nothing.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const now = new Date().toISOString();

  // 1. Due spaced-review concepts
  const { questions: reviewQuestions } = await selectDueReviewQuestions(
    supabase,
    { id: owner, type: user ? 'user' : 'guest' },
    { limit: REVIEW_LIMIT },
  );

  // 2. Due vocabulary words — signed-in only, see docstring above
  let vocabWords: VocabWord[] = [];
  if (user) {
    const { data: dueVocab } = await supabase
      .from('user_vocab_known')
      .select('word_id, interval_days')
      .eq('user_id', user.id)
      .lte('next_review_at', now)
      .limit(VOCAB_LIMIT);
    const wordIds = (dueVocab ?? []).map(r => r.word_id as string);
    if (wordIds.length > 0) {
      const { data: words } = await supabase.from('vocabulary').select('*').in('id', wordIds);
      const intervalByWordId = Object.fromEntries((dueVocab ?? []).map(r => [r.word_id as string, r.interval_days as number]));
      vocabWords = (words ?? []).map(w => ({ ...w, interval_days: intervalByWordId[w.id] ?? 1 })) as VocabWord[];
    }
  }

  // 3. Fresh weak-area questions
  const { data: sessions } = await supabase
    .from('exam_sessions')
    .select('score, section_results')
    .eq('user_id', owner)
    .eq('is_practice', false)
    .not('completed_at', 'is', null)
    .not('score', 'is', null)
    .order('completed_at', { ascending: true });

  const weakness = computeWeakestType((sessions ?? []) as { score: number; section_results: unknown }[]);

  let weakQuestions: Question[] = [];
  if (weakness) {
    weakQuestions = weakness.type === 'reading_comprehension'
      ? await fetchUnseenRCQuestions({ supabase, userKey: owner, difficultyLevel: weakness.level, usedPIds: [] })
      : await fetchUnseenQuestions({ supabase, userKey: owner, type: weakness.type as QuestionType, difficultyLevel: weakness.level, needed: WEAK_PRACTICE_COUNT });
  }

  return NextResponse.json({
    // Both question blocks are practice/review surfaces — options are
    // reshuffled per serve (see src/lib/option-shuffle.ts).
    reviewQuestions: shuffleAllOptions(reviewQuestions),
    vocabWords,
    weakQuestions: shuffleAllOptions(weakQuestions),
    weakType: weakness?.type ?? null,
    weakLevel: weakness?.level ?? null,
    totalItems: reviewQuestions.length + vocabWords.length + weakQuestions.length,
  });
}
