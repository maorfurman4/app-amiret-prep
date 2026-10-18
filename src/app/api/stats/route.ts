import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * GET /api/stats?guestId=xxx
 * Ownership-checked read for the stats page — same reasoning as
 * /api/exam/results: exam_sessions has a public SELECT policy (needed
 * because guests have no auth.uid()), so the app must enforce "only your
 * own rows" here rather than trusting the client-side query filter.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ sessions: [] });

  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select('score, completed_at, section_results')
    .eq('user_id', owner)
    .eq('is_practice', false)
    .not('completed_at', 'is', null)
    .not('score', 'is', null)
    .order('completed_at', { ascending: true });
  // An empty list reads as "no exams yet" — a failed read must not.
  if (error) return NextResponse.json({ error: 'stats unavailable' }, { status: 503 });

  return NextResponse.json({ sessions: sessions ?? [] });
}
