import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { SECTION_CONFIGS, type Question, type SectionResult } from '@/types/exam';

export async function GET(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  const sessionOwner = user?.id ?? guestId;

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  // Ownership is mandatory: without an authenticated user or a guestId,
  // a session id alone must not be enough to read exam content.
  if (!sessionOwner) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  const query = supabase
    .from('exam_sessions')
    .select('questions_by_section, answers_by_section, section_results, is_practice, completed_at')
    .eq('id', sessionId);
  if (sessionOwner) query.eq('user_id', sessionOwner);
  const { data: session, error } = await query.single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (!session.completed_at && !session.is_practice) {
    return NextResponse.json({ error: 'Exam not complete' }, { status: 403 });
  }

  const questionsBySection = session.questions_by_section as Record<number, Question[]>;
  const answersBySection = session.answers_by_section as Record<number, (number | null)[]>;
  const sectionResults = session.section_results as SectionResult[];

  // Flatten all questions with their answers and section metadata
  const questions: (Question & { sectionIndex: number; sectionType: string })[] = [];
  const selectedAnswers: (number | null)[] = [];

  for (const cfg of SECTION_CONFIGS) {
    const sectionQs = questionsBySection[cfg.index] ?? [];
    const sectionAnswers = answersBySection[cfg.index] ?? [];
    for (let i = 0; i < sectionQs.length; i++) {
      questions.push({ ...sectionQs[i], sectionIndex: cfg.index, sectionType: cfg.type });
      selectedAnswers.push(sectionAnswers[i] ?? null);
    }
  }

  // Build section break indices (which flat index starts each section)
  const sectionBreaks: { sectionIndex: number; startAt: number; label: string }[] = [];
  let offset = 0;
  for (const cfg of SECTION_CONFIGS) {
    const count = (questionsBySection[cfg.index] ?? []).length;
    if (count > 0) {
      const label = cfg.type === 'sentence_completion' ? 'השלמת משפטים'
        : cfg.type === 'restatement' ? 'ניסוח מחדש'
        : 'הבנת הנקרא';
      sectionBreaks.push({ sectionIndex: cfg.index, startAt: offset, label });
    }
    offset += count;
  }

  // Per-item latency and any error-cause tag already given, from the
  // responses log. Before the 20260924120000 migration error_cause does not
  // exist yet — fall back to latency only rather than fail the review.
  type ResponseRow = { item_id: string; latency_ms: number | null; error_cause?: string | null };
  const readResponses = (columns: string) => supabase
    .from('responses')
    .select(columns)
    .eq('session_id', sessionId)
    .eq('owner_id', sessionOwner);
  const withCause = await readResponses('item_id, latency_ms, error_cause');
  const rows = withCause.error ? (await readResponses('item_id, latency_ms')).data : withCause.data;
  const responses = Object.fromEntries(((rows ?? []) as unknown as ResponseRow[]).map(r => [
    r.item_id,
    { latencyMs: r.latency_ms, errorCause: r.error_cause ?? null },
  ]));

  return NextResponse.json({ questions, selectedAnswers, sectionBreaks, sectionResults, responses });
}
