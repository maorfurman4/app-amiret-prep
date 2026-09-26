import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { SECTION_CONFIGS, type ExamMode, type Question } from '@/types/exam';
import { recordSeenQuestions } from '@/lib/question-history';
import { planInformativeQuestions } from '@/lib/item-selection';
import { EXAM_START_THETA } from '@/lib/routed-level';

/** Every exam starts where the ability prior is centred: the real test
 * knows nothing about the candidate yet, and neither do we. Shared with the
 * results page, which shows section 1's routed level from it. */
const START_THETA = EXAM_START_THETA;

/**
 * POST /api/exam/start
 * Multistage CAT: initializes ONLY Section 1 — the most informative items
 * at θ = 0 (by calibrated difficulty, src/lib/item-selection.ts). Every
 * subsequent section is fetched in /api/exam/answer after θ is updated.
 *
 * Uses user_question_history for cross-session deduplication so users never
 * see the same question twice until the full pool is exhausted (then resets).
 */
export async function POST(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  let body: { mode?: ExamMode; isPractice?: boolean; guestId?: string; paceHint?: boolean };
  try {
    body = await req.json() as { mode?: ExamMode; isPractice?: boolean; guestId?: string; paceHint?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // user_key identifies the user across sessions (authenticated or guest)
  const userKey = user?.id ?? guestId;
  if (!userKey) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const mode: ExamMode = body.mode ?? 'full';
  const isPractice = body.isPractice ?? false;
  if (!['full', 'practice', 'section', 'esra'].includes(mode) || typeof isPractice !== 'boolean') {
    return NextResponse.json({ error: 'Invalid exam settings' }, { status: 400 });
  }

  const section1Cfg = SECTION_CONFIGS[0]; // { index:1, type:'sentence_completion', questionCount:4 }

  // Section 1: most informative items at the prior mean, unseen first.
  const section1Questions = await planInformativeQuestions({
    supabase,
    userKey,
    type: section1Cfg.type,
    theta: START_THETA,
    needed: section1Cfg.questionCount,
  });

  if (section1Questions.length !== section1Cfg.questionCount) {
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

  const row = {
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
  };
  // Whether the pace gauge was on at the start ("real exam mode" hides it),
  // for measuring its effect. Only recorded when the client says.
  const paceHint = typeof body.paceHint === 'boolean' ? { pace_hint_enabled: body.paceHint } : {};
  const insertSession = (values: object) => supabase.from('exam_sessions').insert(values).select().single();

  let { data: session, error: insertError } = await insertSession({ ...row, ...paceHint });
  // Rollout safety: before the 20260924120000 migration the column does not
  // exist (PGRST204) — start the exam without recording it.
  if (insertError?.code === 'PGRST204' && insertError.message.includes('pace_hint_enabled')) {
    ({ data: session, error: insertError } = await insertSession(row));
  }

  if (insertError || !session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, expiresAt });
}
