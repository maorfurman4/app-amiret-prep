import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { SECTION_CONFIGS, type ExamMode, type Question } from '@/types/exam';
import { routeNextDifficulty } from '@/lib/adaptive';
import { fetchUnseenQuestions, recordSeenQuestions } from '@/lib/question-history';

/**
 * POST /api/exam/start
 * True Multistage CAT: initializes ONLY Section 1 at difficulty=3 (θ=0 start).
 * Every subsequent section is fetched in /api/exam/answer after θ is updated.
 *
 * Uses user_question_history for cross-session deduplication so users never
 * see the same question twice until the full pool is exhausted (then resets).
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  let body: { mode?: ExamMode; isPractice?: boolean; guestId?: string };
  try {
    body = await req.json() as { mode?: ExamMode; isPractice?: boolean; guestId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // user_key identifies the user across sessions (authenticated or guest)
  const userKey = user?.id ?? body.guestId ?? crypto.randomUUID();

  const mode: ExamMode = body.mode ?? 'full';
  const isPractice = body.isPractice ?? false;

  // Initial θ=0 → difficulty level 3
  const initialDifficulty = routeNextDifficulty(0); // = 3
  const section1Cfg = SECTION_CONFIGS[0]; // { index:1, type:'sentence_completion', questionCount:4 }

  // Fetch Section 1 questions, excluding already-seen ones cross-session
  const section1Questions = await fetchUnseenQuestions({
    supabase,
    userKey,
    type: section1Cfg.type,
    difficultyLevel: initialDifficulty,
    needed: section1Cfg.questionCount,
  });

  if (section1Questions.length === 0) {
    return NextResponse.json({ error: 'No questions available. Please try again later.' }, { status: 503 });
  }

  // Mark these questions as seen in cross-session history
  await recordSeenQuestions(supabase, userKey, section1Questions.map((q: Question) => q.id));

  const questionsBySection: Record<number, Question[]> = {
    1: section1Questions,
  };

  // Server timer for Section 1
  const expiresAt = new Date(Date.now() + section1Cfg.durationSeconds * 1000).toISOString();

  const section1QuestionIds = section1Questions.map((q: Question) => q.id);

  const { data: session, error: insertError } = await supabase
    .from('exam_sessions')
    .insert({
      user_id: userKey,
      mode,
      is_practice: isPractice,
      current_section_index: 1,
      current_section_expires_at: isPractice ? null : expiresAt,
      theta: 0,
      theta_history: [],
      questions_by_section: questionsBySection,
      answers_by_section: {},
      section_results: [],
      used_question_ids: section1QuestionIds,
      used_passage_ids: [],
    })
    .select()
    .single();

  if (insertError || !session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, expiresAt });
}
