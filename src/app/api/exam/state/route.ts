import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * GET /api/exam/state?sessionId=xxx
 * Returns current session state for F5-recovery. The client derives its own
 * remaining-time and auto-advance behavior from session.current_section_expires_at
 * (ExamTimer compares it to Date.now() itself, firing immediately if already
 * past due), so this endpoint just needs to return that timestamp as part of
 * the session — it doesn't need to precompute a countdown value itself.
 */
export async function GET(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const sessionOwner = user?.id ?? guestId;
  if (!sessionOwner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { data: session } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', sessionOwner)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Real exam: strip correct_answer AND explanation (its options_analysis marks
  // the right option) so the client cannot cheat mid-exam.
  // Practice mode NEEDS both — the client colors answers and shows explanations
  // immediately, so stripping them broke practice feedback entirely.
  const safeSession = session.is_practice ? session : {
    ...session,
    section_results: [],
    questions_by_section: Object.fromEntries(
      Object.entries((session.questions_by_section as Record<string, unknown[]>) ?? {}).map(
        ([k, qs]) => [k, (qs as Record<string, unknown>[]).map(question => {
          const safe = { ...question };
          delete safe.correct_answer;
          delete safe.explanation;
          delete safe.hint;
          // For sentence completion the target word IS the correct option,
          // so every concept tag is as much a key as correct_answer.
          delete safe.skill;
          delete safe.target_lemma;
          delete safe.concept_key;
          return safe;
        })]
      )
    ),
  };

  // serverNow lets the client measure its own clock's skew against the
  // server's (see exam/[sessionId]/page.tsx's loadSession) — a client whose
  // system clock runs slow would otherwise keep counting down past the true
  // section deadline (its Date.now() takes longer to reach expiresAt), so
  // its auto-submit lands at the server genuinely late relative to
  // LATE_GRACE_MS even though the student answered everything within the
  // real time budget shown on screen.
  return NextResponse.json({ session: safeSession, serverNow: new Date().toISOString() });
}

/**
 * DELETE /api/exam/state?sessionId=xxx
 * Exiting mid-exam has no resume flow (the /exam picker only ever starts a
 * fresh session), so an abandoned session would otherwise sit in the DB
 * forever. Deleting it on exit makes the "this exam is discarded" warning
 * shown to the user actually true, and avoids orphaned rows.
 */
export async function DELETE(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  // The current (not-yet-submitted) section's questions were already marked
  // "seen" the moment they were fetched (either by /api/exam/start for
  // section 1, or by the previous section's commit for every section after
  // that) — but the user is about to discard the exam without ever actually
  // answering or being scored on them. Read them now so they can be rolled
  // back out of the shared question pool after the session row is gone,
  // instead of being permanently unavailable for a session the user never
  // completed.
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('current_section_index, questions_by_section')
    .eq('id', sessionId)
    .eq('user_id', owner)
    .is('completed_at', null)
    .maybeSingle();

  const { error } = await supabase
    .from('exam_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', owner)
    .is('completed_at', null); // never delete a finished exam

  if (error) return NextResponse.json({ error: 'Could not discard exam' }, { status: 503 });

  if (session) {
    const bySection = (session.questions_by_section ?? {}) as Record<string, { id: string; passage_id?: string | null }[]>;
    const currentQuestions = bySection[String(session.current_section_index)] ?? [];
    const questionIds = currentQuestions.map(q => q.id);
    const passageIds = [...new Set(currentQuestions.map(q => q.passage_id).filter((id): id is string => !!id))];

    if (questionIds.length > 0) {
      await supabase.from('user_question_history').delete().eq('user_key', owner).in('question_id', questionIds);
    }
    if (passageIds.length > 0) {
      await supabase.from('user_passage_history').delete().eq('user_key', owner).in('passage_id', passageIds);
    }
  }

  return NextResponse.json({ ok: true });
}
