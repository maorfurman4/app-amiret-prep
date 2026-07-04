import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { SECTION_CONFIGS, isExperimentalSection, type Question, type SectionResult } from '@/types/exam';
import { updateThetaAfterSection, routeNextDifficulty, thetaToScore, correctCount } from '@/lib/adaptive';
import {
  fetchUnseenQuestions,
  recordSeenQuestions,
  fetchUnseenRCQuestions,
  recordSeenPassage,
} from '@/lib/question-history';

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
export async function POST(req: NextRequest) {
  const { authClient, supabase } = await getServerClients();
  const { data: { user } } = await authClient.auth.getUser();

  let body: { sessionId: string; sectionIndex: number; answers: (number | null)[]; guestId?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userKey = user?.id ?? body.guestId ?? null;

  const query = supabase.from('exam_sessions').select('*').eq('id', body.sessionId);
  if (userKey) query.eq('user_id', userKey);
  const { data: session, error: fetchErr } = await query.single();

  if (fetchErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.completed_at) {
    return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
  }

  const sectionIndex = body.sectionIndex;
  if (!Number.isInteger(sectionIndex) || sectionIndex < 1 || sectionIndex > SECTION_CONFIGS.length) {
    return NextResponse.json({ error: 'Invalid sectionIndex' }, { status: 400 });
  }

  if (session.current_section_index !== sectionIndex) {
    return NextResponse.json({ error: 'Section mismatch' }, { status: 400 });
  }

  const questionsBySection = session.questions_by_section as Record<number, Question[]>;
  const currentQuestions = questionsBySection[body.sectionIndex] ?? [];

  // Validate answers: must be same length as questions, each null or 0-3
  if (!Array.isArray(body.answers) || body.answers.length !== currentQuestions.length) {
    return NextResponse.json({ error: 'Invalid answers length' }, { status: 400 });
  }
  if (!body.answers.every(a => a === null || (Number.isInteger(a) && a >= 0 && a <= 3))) {
    return NextResponse.json({ error: 'Invalid answer value' }, { status: 400 });
  }
  const cfg = SECTION_CONFIGS[body.sectionIndex - 1];

  // ── Step 1: Update θ via MLE/EAP (cumulative — all sections, not just current) ─
  const previousResults = (session.section_results as SectionResult[]);
  const allQuestions: Question[] = [
    ...previousResults.flatMap(sr => sr.questions as Question[]),
    ...currentQuestions,
  ];
  const allAnswers: (number | null)[] = [
    ...previousResults.flatMap(sr => sr.answers as (number | null)[]),
    ...body.answers,
  ];
  const sectionForAdaptive = { questions: allQuestions, answers: allAnswers };
  const newTheta = updateThetaAfterSection(session.theta, sectionForAdaptive);

  const currentSectionResult = { questions: currentQuestions, answers: body.answers };
  const result: SectionResult = {
    sectionIndex: body.sectionIndex,
    type: cfg.type,
    questions: currentQuestions,
    answers: body.answers,
    thetaBefore: session.theta,
    thetaAfter: newTheta,
    correctCount: correctCount(currentSectionResult),
    totalCount: currentQuestions.length,
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
    answers_by_section: { ...session.answers_by_section, [body.sectionIndex]: body.answers },
    section_results: [...(session.section_results as object[]), result],
  };

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
    const scoreWithExperimental = thetaToScore(newTheta);
    const finalIsExperimental = scoreWithExperimental > baseScore;

    updatePayload.completed_at = new Date().toISOString();
    updatePayload.theta_final = finalIsExperimental ? newTheta : baseTheta;
    updatePayload.score = Math.max(baseScore, scoreWithExperimental);
    updatePayload.current_section_expires_at = null;
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
      nextQuestions = await fetchUnseenRCQuestions({
        supabase,
        userKey,
        difficultyLevel: nextDifficulty,
        usedPIds,
      });

      if (nextQuestions.length > 0) {
        const passageId = nextQuestions[0].passage_id!;
        updatePayload.used_passage_ids = [...usedPIds, passageId];
        if (userKey) {
          await recordSeenPassage(supabase, userKey, passageId);
        }
      }
    } else {
      if (userKey) {
        // Cross-session deduplication
        nextQuestions = await fetchUnseenQuestions({
          supabase,
          userKey,
          type: nextCfg.type,
          difficultyLevel: nextDifficulty,
          needed: nextCfg.questionCount,
        });
        await recordSeenQuestions(supabase, userKey, nextQuestions.map(q => q.id));
      } else {
        // No user_key — fall back to in-session deduplication only
        let qQuery = supabase
          .from('questions')
          .select('*')
          .eq('type', nextCfg.type)
          .eq('difficulty_level', nextDifficulty)
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

    const newQIds = nextQuestions.map(q => q.id);
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

  const { error: updateErr } = await supabase
    .from('exam_sessions')
    .update(updatePayload)
    .eq('id', body.sessionId);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }

  return NextResponse.json({
    newTheta,
    score: isLastSection ? (updatePayload.score as number) : null,
    isComplete: isLastSection,
    nextSectionIndex: isLastSection ? null : nextSectionIndex,
    nextExpiresAt: updatePayload.current_section_expires_at ?? null,
  });
}
