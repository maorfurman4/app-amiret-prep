import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { computeStreak } from '@/lib/streak-server';

export interface DashboardSummary {
  streak: number;
  lastScore: number | null;
  examCount: number;
  reviewDueCount: number;
}

const EMPTY: DashboardSummary = { streak: 0, lastScore: null, examCount: 0, reviewDueCount: 0 };

/**
 * GET /api/dashboard-summary?guestId=xxx
 *
 * Purpose-built, minimal-payload aggregate for the home page. Deliberately
 * NOT a reuse of /api/stats (which returns every completed session incl.
 * the section_results JSONB blob — far more than a homepage badge needs)
 * or /api/review-queue (which joins full question data just to show a
 * count). Every query here is either a `head: true` count or a
 * single-row select, so this is the cheapest possible read for what the
 * home page actually renders. One round trip instead of three.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json(EMPTY);

  const now = new Date().toISOString();

  let reviewQuery = supabase
    .from('review_queue')
    .select('id', { count: 'exact', head: true })
    .lte('next_review_at', now);
  reviewQuery = user ? reviewQuery.eq('user_id', user.id) : reviewQuery.eq('guest_id', guestId!);

  const [streak, lastScoreRes, examCountRes, reviewCountRes] = await Promise.all([
    computeStreak(supabase, owner),
    supabase
      .from('exam_sessions')
      .select('score')
      .eq('user_id', owner)
      .eq('is_practice', false)
      .not('completed_at', 'is', null)
      .not('score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('exam_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', owner)
      .eq('is_practice', false)
      .not('completed_at', 'is', null)
      .not('score', 'is', null),
    reviewQuery,
  ]);

  return NextResponse.json({
    streak,
    lastScore: lastScoreRes.data?.score ?? null,
    examCount: examCountRes.count ?? 0,
    reviewDueCount: reviewCountRes.count ?? 0,
  } satisfies DashboardSummary);
}
