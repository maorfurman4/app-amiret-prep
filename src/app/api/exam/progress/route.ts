import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { isPastSectionDeadline } from '@/lib/exam-deadline';
import type { Question } from '@/types/exam';

/**
 * POST /api/exam/progress  { sessionId, sectionIndex, answers }
 * Saves the current section's answers while it is still running, so the
 * server holds every pick made in time. A phone that locks or switches apps
 * freezes the page — the auto-submit then reaches /api/exam/answer after the
 * deadline, and a late section is scored on exactly these saved answers
 * instead of being wiped.
 *
 * Accepted only for the caller's own timed exam, for the section it is on,
 * and before the deadline (+ the same grace the submit allows). The answers
 * live in the section's slot of answers_by_section, which the section
 * submit overwrites with the final answers. Nothing about correctness is
 * returned.
 */
const bodySchema = z.object({
  sessionId: z.string().min(1),
  sectionIndex: z.int().min(1),
  answers: z.array(z.union([z.null(), z.int().min(0).max(3)])),
});

export async function POST(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId ?? null;
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { sessionId, sectionIndex, answers } = parsed.data;

  const { data: session } = await supabase
    .from('exam_sessions')
    .select('current_section_index, current_section_expires_at, completed_at, is_practice, questions_by_section, answers_by_section')
    .eq('id', sessionId)
    .eq('user_id', owner)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  // Untimed: nothing to protect, and its answers are revealed as they're given.
  if (session.is_practice) return NextResponse.json({ error: 'Practice exams are not saved mid-section' }, { status: 400 });
  if (session.completed_at) return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
  if (session.current_section_index !== sectionIndex) return NextResponse.json({ error: 'Section mismatch' }, { status: 409 });

  const questions = ((session.questions_by_section ?? {}) as Record<string, Question[]>)[String(sectionIndex)] ?? [];
  if (answers.length !== questions.length) return NextResponse.json({ error: 'Invalid answers length' }, { status: 400 });

  // Past the deadline nothing changes any more — what was saved in time stands.
  if (isPastSectionDeadline(session)) return NextResponse.json({ error: 'Section time is over' }, { status: 409 });

  // Conditional on the section: if a submit moved the session on meanwhile,
  // this write matches no row and can't land in the wrong section.
  const { data: written, error } = await supabase
    .from('exam_sessions')
    .update({ answers_by_section: { ...((session.answers_by_section ?? {}) as object), [sectionIndex]: answers } })
    .eq('id', sessionId)
    .eq('user_id', owner)
    .eq('current_section_index', sectionIndex)
    .is('completed_at', null)
    .select('id');

  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 503 });
  if (!written || written.length === 0) return NextResponse.json({ error: 'Section mismatch' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
