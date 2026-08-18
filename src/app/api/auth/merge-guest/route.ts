import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/auth/merge-guest  { guestId }
 * Called once after login: moves everything the user accumulated as a guest
 * (exam sessions, review queue, seen-question/passage history) onto their
 * account, then recomputes user_stats + leaderboard from the merged history.
 * Idempotent — a second call finds nothing left to move.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: { guestId?: unknown };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const guestId = body.guestId;
  if (typeof guestId !== 'string' || !UUID_RE.test(guestId) || guestId === user.id) {
    return NextResponse.json({ error: 'Invalid guestId' }, { status: 400 });
  }

  // 1. Exam sessions (completed and in-progress alike — the client now sends
  //    a bearer token, so merged in-progress sessions stay accessible)
  await supabase.from('exam_sessions').update({ user_id: user.id }).eq('user_id', guestId);

  // 2. Review queue — drop guest rows that duplicate the account, move the rest
  const { data: mine } = await supabase.from('review_queue').select('question_id').eq('user_id', user.id);
  const mineIds = (mine ?? []).map(r => r.question_id as string);
  if (mineIds.length > 0) {
    await supabase.from('review_queue').delete().eq('guest_id', guestId).in('question_id', mineIds);
  }
  await supabase.from('review_queue').update({ user_id: user.id, guest_id: null }).eq('guest_id', guestId);

  // 3. Seen-question / seen-passage history (cross-session dedup keys)
  const { data: myQ } = await supabase.from('user_question_history').select('question_id').eq('user_key', user.id);
  const myQIds = (myQ ?? []).map(r => r.question_id as string);
  if (myQIds.length > 0) {
    await supabase.from('user_question_history').delete().eq('user_key', guestId).in('question_id', myQIds);
  }
  await supabase.from('user_question_history').update({ user_key: user.id }).eq('user_key', guestId);

  const { data: myP } = await supabase.from('user_passage_history').select('passage_id').eq('user_key', user.id);
  const myPIds = (myP ?? []).map(r => r.passage_id as string);
  if (myPIds.length > 0) {
    await supabase.from('user_passage_history').delete().eq('user_key', guestId).in('passage_id', myPIds);
  }
  await supabase.from('user_passage_history').update({ user_key: user.id }).eq('user_key', guestId);

  // 4. Recompute user_stats + leaderboard from the merged exam history
  //    (the completion trigger never saw the guest exams)
  const { data: sessions } = await supabase
    .from('exam_sessions')
    .select('score, completed_at')
    .eq('user_id', user.id)
    .eq('is_practice', false)
    .not('completed_at', 'is', null)
    .not('score', 'is', null)
    .order('completed_at', { ascending: true });

  const rows = (sessions ?? []) as { score: number; completed_at: string }[];
  if (rows.length > 0) {
    const scores = rows.map(r => r.score);
    const meta = user.user_metadata as { full_name?: string; avatar_url?: string } | null;
    // This route re-runs on every login (idempotent by design), so it must
    // not clobber a display name the user deliberately set via the profile
    // menu — only fall back to the OAuth-provided name when nothing custom
    // exists yet.
    const { data: existingStats } = await supabase
      .from('user_stats')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const stats = {
      user_id: user.id,
      total_exams: rows.length,
      best_score: Math.max(...scores),
      avg_score: scores.reduce((a, b) => a + b, 0) / scores.length,
      last_exam_at: rows[rows.length - 1].completed_at,
      score_history: rows.map(r => ({ date: r.completed_at, score: r.score })),
      display_name: existingStats?.display_name ?? meta?.full_name ?? null,
      avatar_url: existingStats?.avatar_url ?? meta?.avatar_url ?? null,
    };
    await supabase.from('user_stats').upsert(stats, { onConflict: 'user_id' });
    await supabase.from('leaderboard').upsert({
      user_id: stats.user_id,
      display_name: stats.display_name,
      avatar_url: stats.avatar_url,
      best_score: stats.best_score,
      total_exams: stats.total_exams,
      avg_score: stats.avg_score,
      last_exam_at: stats.last_exam_at,
    }, { onConflict: 'user_id' });
  }

  return NextResponse.json({ ok: true, mergedExams: rows.length });
}
