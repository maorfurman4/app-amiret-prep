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
  const { supabase, user } = await getServerClients();
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const guestId = req.nextUrl.searchParams.get('guestId');
  const owner = user?.id ?? guestId;

  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { data: session, error } = await supabase
    .from('exam_sessions')
    .select('score, theta_final, theta_history, section_results, answers_by_section, questions_by_section, is_practice')
    .eq('id', sessionId)
    .eq('user_id', owner)
    .single();

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ session });
}
