import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { SECTION_CONFIGS, isExperimentalSection, type Question, type SectionResult } from '@/types/exam';
import { updateThetaAfterSection, routeNextDifficulty, thetaToScore, correctCount } from '@/lib/adaptive';
import {
  planUnseenQuestions,
  planUnseenRCQuestions,
} from '@/lib/question-history';
import { buildExamResponseRows } from '@/lib/responses';
import { applyResponsesToSrs } from '@/lib/srs';

/**
 * POST /api/exam/answer
 * True Multistage CAT:
 *  1. Updates θ via MLE/EAP based on the completed section.
 *  2. Derives the difficulty level for the NEXT section from the new θ.
 *  3. Fetches ONLY the next section's questions from DB at that difficulty.
 * No section is ever pre-fetched — every section is determined adaptively.
 *
 * Uses user_question_history / user_passage_history for cross-session deduplication.
 */
const bodySchema = z.object({
  sessionId: z.string().min(1),
  sectionIndex: z.int().min(1),
  answers: z.array(z.union([z.null(), z.int().min(0).max(3)])),
  // Soft field: invalid/mismatched timings are dropped, not rejected (see
  // the cross-check against currentQuestions.length further down) — kept
  // loose here, just enough to guarantee the array-of-numbers shape.
  timings: z.array(z.number()).optional(),
});

export async function POST(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const body = parsed.data;

  const userKey = user?.id ?? guestId ?? null;
  if (!userKey) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { data: session, error: fetchErr } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', body.sessionId)
    .eq('user_id', userKey)
    .single();

  if (fetchErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.completed_at) {
    return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
  }

  const sectionIndex = body.sectionIndex;
  // Shape/range of sectionIndex and answers is already guaranteed by
  // bodySchema above; what's left is checking it against THIS session's
  // actual state, which no static schema can know in advance.
  if (sectionIndex > SECTION_CONFIGS.length) {
    return NextResponse.json({ error: 'Invalid sectionIndex' }, { status: 400 });
  }

  if (session.current_section_index !== sectionIndex) {
    // 409 Conflict, not 400 — this fires whenever the session has already
    // moved on from the section the client thinks it's still submitting
    // (a stale resubmit whose earlier attempt actually succeeded server-
    // side, a second tab, or a timed-out retry), which is exactly the same
    // "server is the source of truth, resync" case the client's 409
    // handling already covers below. It was a genuine request that arrived
    // in the wrong state, not a malformed one, so 400 was the wrong status
    // to begin with — this fix is the status code, not new client logic.
    return NextResponse.json({ error: 'Section mismatch' }, { status: 409 });
  }

  const questionsBySection = session.questions_by_section as Record<number, Question[]>;
  const currentQuestions = questionsBySection[body.sectionIndex] ?? [];

  if (body.answers.length !== currentQuestions.length) {
    return NextResponse.json({ error: 'Invalid answers length' }, { status: 400 });
  }
  const cfg = SECTION_CONFIGS[body.sectionIndex - 1];

  // Server-side time enforcement. The client auto-submits at 0:00 and
  // /api/exam/state auto-submits blanks if it sees an expired timer, so a
  // hard reject here would just bounce those legitimate late-by-a-second
  // submits. Instead, mirror the real exam: past the deadline (plus a short
  // grace for network/clock skew) the section is scored as unanswered and
  // the exam still advances. Practice sessions are untimed.
  const LATE_GRACE_MS = 20_000;
  const lateSubmission = !session.is_practice
    && !!session.current_section_expires_at
    && Date.now() > new Date(session.current_section_expires_at).getTime() + LATE_GRACE_MS;
  const answers: (number | null)[] = lateSubmission ? currentQuestions.map(() => null) : body.answers;

  // ── Step 1: Update θ via MLE/EAP (cumulative — all sections, not just current) ─
  const previousResults = (session.section_results as SectionResult[]);
  const allQuestions: Question[] = [
    ...previousResults.flatMap(sr => sr.questions as Question[]),
    ...currentQuestions,
  ];
  const allAnswers: (number | null)[] = [
    ...previousResults.flatMap(sr => sr.answers as (number | null)[]),
    ...answers,
  ];
  const sectionForAdaptive = { questions: allQuestions, answers: allAnswers };
  const newTheta = updateThetaAfterSection(session.theta, sectionForAdaptive);

  // Optional per-question pace data — accepted only if well-formed. The
  // raw (sub-second) values feed the responses log's latency; the section
  // result keeps whole seconds for the results page's pacing display.
  const rawTimings = Array.isArray(body.timings)
    && body.timings.length === currentQuestions.length
    && body.timings.every(t => typeof t === 'number' && isFinite(t) && t >= 0 && t < 3600)
    ? body.timings
    : undefined;
  const timings = rawTimings?.map(t => Math.round(t));

  const currentSectionResult = { questions: currentQuestions, answers };
  const result: SectionResult = {
    sectionIndex: body.sectionIndex,
    type: cfg.type,
    questions: currentQuestions,
    answers,
    thetaBefore: session.theta,
    thetaAfter: newTheta,
    correctCount: correctCount(currentSectionResult),
    totalCount: currentQuestions.length,
    ...(timings ? { timings } : {}),
  };

  const newHistory = [
    ...(session.theta_history as object[]),
    { after_section: body.sectionIndex, theta: newTheta },
  ];

  const nextSectionIndex = body.sectionIndex + 1;
  const isLastSection = nextSectionIndex > SECTION_CONFIGS.length;

  const updatePayload: Record<string, unknown> = {
    theta: newTheta,
    theta_history: newHistory,
    current_section_index: nextSectionIndex,
    answers_by_section: { ...session.answers_by_section, [body.sectionIndex]: answers },
    section_results: [...(session.section_results as object[]), result],
  };
  let resetQuestionIds: string[] = [];
  let resetPassageHistory = false;
  let seenQuestionIds: string[] = [];
  let seenPassageId: string | null = null;
  let activityDate: string | null = null;
  let activitySource: string | null = null;

  if (isLastSection) {
    // Exam complete — no more sections to fetch.
    // AMIRNET rule: the experimental section can only RAISE the score.
    // Base θ is estimated from scored sections only (1-6); if including the
    // experimental answers yields a higher score, the higher one is kept.
    const allResults = [...previousResults, result];
    const scoredResults = allResults.filter(sr => !isExperimentalSection(sr.sectionIndex));
    const baseTheta = updateThetaAfterSection(session.theta, {
      questions: scoredResults.flatMap(sr => sr.questions as Question[]),
      answers: scoredResults.flatMap(sr => sr.answers as (number | null)[]),
    });
    const baseScore = thetaToScore(baseTheta);
    // Official AMIRNET rule: the experimental section can only raise the
    // final score, and by at most 2 points.
    const scoreWithExperimental = Math.min(thetaToScore(newTheta), baseScore + 2);
    const finalIsExperimental = scoreWithExperimental > baseScore;

    updatePayload.completed_at = new Date().toISOString();
    updatePayload.theta_final = finalIsExperimental ? newTheta : baseTheta;
    updatePayload.score = Math.max(baseScore, scoreWithExperimental);
    updatePayload.current_section_expires_at = null;

    activityDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
    activitySource = session.is_practice ? 'practice_exam' : 'exam';
  } else {
    // ── Step 2: Derive next difficulty from updated θ ──────────────────────────
    const nextDifficulty = routeNextDifficulty(newTheta);
    const nextCfg = SECTION_CONFIGS[nextSectionIndex - 1];

    // in-session tracking (kept for within-session RC passage deduplication)
    const usedQIds: string[] = (session.used_question_ids as string[] | null) ?? [];
    const usedPIds: string[] = (session.used_passage_ids as string[] | null) ?? [];

    // ── Step 3: Fetch ONLY next section from DB at the adaptive difficulty ─────
    let nextQuestions: Question[] = [];

    if (nextCfg.type === 'reading_comprehension') {
      const selection = await planUnseenRCQuestions({
        supabase,
        userKey,
        difficultyLevel: nextDifficulty,
        usedPIds,
      });
      nextQuestions = selection.questions;
      resetPassageHistory = selection.resetPassageHistory;

      if (nextQuestions.length > 0) {
        seenPassageId = nextQuestions[0].passage_id!;
        updatePayload.used_passage_ids = [...usedPIds, seenPassageId];
      }
    } else {
      if (userKey) {
        // Cross-session deduplication
        const selection = await planUnseenQuestions({
          supabase,
          userKey,
          type: nextCfg.type,
          difficultyLevel: nextDifficulty,
          needed: nextCfg.questionCount,
        });
        nextQuestions = selection.questions;
        resetQuestionIds = selection.resetQuestionIds;
      } else {
        // No user_key — fall back to in-session deduplication only
        let qQuery = supabase
          .from('questions')
          .select('*')
          .eq('type', nextCfg.type)
          .eq('difficulty_level', nextDifficulty)
          .eq('active', true)
          .limit(nextCfg.questionCount + 10);
        if (usedQIds.length > 0) {
          qQuery = qQuery.not('id', 'in', `(${usedQIds.join(',')})`);
        }
        const { data: qs } = await qQuery;
        nextQuestions = ((qs ?? []) as Question[])
          .sort(() => Math.random() - 0.5)
          .slice(0, nextCfg.questionCount);
      }
    }

    if (nextQuestions.length !== nextCfg.questionCount) {
      return NextResponse.json({ error: 'לא ניתן לטעון פרק מלא כרגע. נסה שוב.' }, { status: 503 });
    }
    const newQIds = nextQuestions.map(q => q.id);
    seenQuestionIds = newQIds;
    updatePayload.used_question_ids = [...usedQIds, ...newQIds];

    // Write only the newly fetched section; keep completed sections for results page
    updatePayload.questions_by_section = {
      ...questionsBySection,
      [nextSectionIndex]: nextQuestions,
    };

    // Server timer for next section
    if (!session.is_practice) {
      updatePayload.current_section_expires_at = new Date(
        Date.now() + nextCfg.durationSeconds * 1000,
      ).toISOString();
    }
  }

  // Every question in the section is logged — right, wrong, or left blank
  // (a late submission logs the blanks it was scored as).
  const responseRows = buildExamResponseRows({
    questions: currentQuestions,
    answers,
    timingsSeconds: rawTimings,
    ownerType: user ? 'user' : 'guest',
    isPractice: !!session.is_practice,
    thetaBefore: session.theta,
    sectionIndex: body.sectionIndex,
  });

  // One database transaction commits the session and every durable side
  // effect, including the response log rows. The row-level conditional
  // update makes concurrent submissions serialize; the loser returns false
  // before any history (or response) writes can run.
  const { data: updated, error: updateErr } = await supabase.rpc('commit_exam_section', {
    p_session_id: body.sessionId,
    p_owner_id: userKey,
    p_section_index: body.sectionIndex,
    p_update: updatePayload,
    p_reset_question_ids: resetQuestionIds,
    p_seen_question_ids: seenQuestionIds,
    p_reset_passage_history: resetPassageHistory,
    p_seen_passage_id: seenPassageId,
    p_activity_date: activityDate,
    p_activity_source: activitySource,
    // Spaced repetition no longer goes through review_queue — see the FSRS
    // step after the commit below.
    p_wrong_question_ids: [],
    p_review_owner_type: user ? 'user' : 'guest',
    p_responses: responseRows,
  });

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'Section already submitted' }, { status: 409 });
  }

  // Spaced repetition runs once, at completion: real exam answers are never
  // revealed mid-exam (anti-cheat), and an abandoned exam schedules nothing.
  // Every scored answer — right or wrong — feeds its concept's FSRS card,
  // read back from the response rows the commit above just logged, with
  // their real latencies and timestamps. The exam itself is already safely
  // committed, so a scheduling failure is logged, not surfaced.
  if (isLastSection) {
    const { data: logged, error: logErr } = await supabase
      .from('responses')
      .select('item_id, correct, chosen_option, latency_ms, created_at')
      .eq('session_id', body.sessionId);
    const srs = logErr
      ? { error: logErr.message }
      : await applyResponsesToSrs(
          supabase,
          { id: userKey, type: user ? 'user' : 'guest' },
          ((logged ?? []) as { item_id: string; correct: boolean; chosen_option: number | null; latency_ms: number | null; created_at: string }[])
            .map(r => ({ itemId: r.item_id, correct: r.correct, answered: r.chosen_option !== null, latencyMs: r.latency_ms, at: new Date(r.created_at) })),
        ).catch((e: unknown) => ({ error: String(e) }));
    if (srs.error) console.error('[exam/answer] SRS update failed:', srs.error);
  }

  return NextResponse.json({
    newTheta,
    score: isLastSection ? (updatePayload.score as number) : null,
    isComplete: isLastSection,
    nextSectionIndex: isLastSection ? null : nextSectionIndex,
    nextExpiresAt: updatePayload.current_section_expires_at ?? null,
    lateSubmission,
  });
}
