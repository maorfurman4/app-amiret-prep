import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * GET /api/exam/results?sessionId=xxx&guestId=yyy
 * Ownership-checked read for the results page. Exists so the client never
 * queries exam_sessions directly — that table has a public SELECT policy
 * (guests aren't authenticated, so RLS can't scope by auth.uid() alone),
 * so ownership must be enforced here instead of relying on the DB policy.
 */
export async function GET(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const owner = user?.id ?? guestId;

  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { data: session, error } = await supabase
    .from('exam_sessions')
    .select('score, theta_final, theta_se, p_exempt, theta_history, section_results, answers_by_section, questions_by_section, is_practice, completed_at')
    .eq('id', sessionId)
    .eq('user_id', owner)
    .single();

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // questions_by_section carries correct_answer for every section. For a
  // real (non-practice) exam that isn't finished yet, that is an answer key
  // for the sections still in play — refuse until completed_at is set.
  if (!session.is_practice && !session.completed_at) {
    return NextResponse.json({ error: 'Exam not finished' }, { status: 403 });
  }
  return NextResponse.json({ session });
}
