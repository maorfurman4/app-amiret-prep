import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { GUEST_COOKIE } from '@/lib/guest-token';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Generous but bounded — a real guest's local vocab lists are at most a
// few thousand words; this just stops a malformed/huge body from turning
// into an unbounded query.
const MAX_VOCAB_IDS = 5000;

function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id));
  return [...new Set(ids)].slice(0, MAX_VOCAB_IDS);
}

/**
 * POST /api/auth/merge-guest  { vocabKnown?: string[], vocabFavorites?: string[] }
 * Called once after login: moves everything the user accumulated as a guest
 * (exam sessions, review queue, seen-question/passage history, activity/streak
 * log, response log) onto their account, then recomputes user_stats + leaderboard from the
 * merged history. Also unions in the guest's locally-known/favorited vocab
 * word ids passed in the body — those tables have a hard FK to auth.users,
 * so a guest (who has no auth.users row) can never write them directly; the
 * only copy of that progress lives in the guest's own localStorage, and this
 * is the one moment it can be handed to the server. Idempotent — a second
 * call finds nothing left to move (and re-sending the same vocab ids is a
 * harmless no-op via ON CONFLICT).
 */
export async function POST(req: Request) {
  const { supabase, user, guestId } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { vocabKnown?: unknown; vocabFavorites?: unknown };
  const vocabKnownIds = sanitizeIds(body.vocabKnown);
  const vocabFavoriteIds = sanitizeIds(body.vocabFavorites);

  // Only the signed server cookie proves ownership, never the request body.
  if (typeof guestId !== 'string' || !UUID_RE.test(guestId) || guestId === user.id) {
    return NextResponse.json({ error: 'Invalid guestId' }, { status: 400 });
  }

  // exam_sessions.user_id holds guest UUIDs and auth UUIDs in the same
  // column, so without this check a logged-in caller could pass ANOTHER
  // registered user's id as "guestId" and re-home that user's entire
  // history onto their own account. Fail closed: if the admin lookup
  // itself errors (no service role locally), refuse rather than merge.
  const { data: existing, error: lookupErr } = await supabase.auth.admin.getUserById(guestId);
  if (lookupErr && lookupErr.status !== 404) {
    return NextResponse.json({ error: 'Could not verify guestId' }, { status: 503 });
  }
  if (existing?.user) {
    return NextResponse.json({ error: 'Invalid guestId' }, { status: 403 });
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

  // 4. Activity log (drives the streak) — same dedupe-then-move pattern as
  //    review_queue above: a day the account already has activity for wins,
  //    any other guest-only day is carried over so the streak reflects the
  //    full merged history, not just what happened after signup.
  const { data: myDays } = await supabase.from('activity_log').select('activity_date').eq('user_id', user.id);
  const myDayStrs = (myDays ?? []).map(r => r.activity_date as string);
  if (myDayStrs.length > 0) {
    await supabase.from('activity_log').delete().eq('user_id', guestId).in('activity_date', myDayStrs);
  }
  await supabase.from('activity_log').update({ user_id: user.id }).eq('user_id', guestId);

  //    Response log — every row is a distinct answer event, so there is
  //    nothing to dedupe; the guest's rows simply become the account's.
  await supabase.from('responses')
    .update({ owner_id: user.id, owner_type: 'user' })
    .eq('owner_type', 'guest')
    .eq('owner_id', guestId);

  // 5. Vocabulary "known" / "favorite" progress. user_vocab_known/favorites
  //    both have a FOREIGN KEY on user_id -> auth.users, so a guest row can
  //    never exist there — the guest's only copy of this progress is the
  //    id lists the client read from its own localStorage and sent above.
  //    This is additive (ON CONFLICT DO NOTHING): it only ever adds words
  //    the account doesn't already have, never removes or overwrites one
  //    the account already marked known/favorited itself.
  let mergedVocabKnown = 0;
  let mergedVocabFavorites = 0;
  const candidateIds = [...new Set([...vocabKnownIds, ...vocabFavoriteIds])];
  if (candidateIds.length > 0) {
    const { data: validWords } = await supabase.from('vocabulary').select('id').in('id', candidateIds);
    const validIds = new Set((validWords ?? []).map(w => w.id as string));

    const knownRows = vocabKnownIds.filter(id => validIds.has(id)).map(word_id => ({ user_id: user.id, word_id }));
    if (knownRows.length > 0) {
      const { error } = await supabase.from('user_vocab_known')
        .upsert(knownRows, { onConflict: 'user_id,word_id', ignoreDuplicates: true });
      if (!error) mergedVocabKnown = knownRows.length;
    }

    const favRows = vocabFavoriteIds.filter(id => validIds.has(id)).map(word_id => ({ user_id: user.id, word_id }));
    if (favRows.length > 0) {
      const { error } = await supabase.from('user_vocab_favorites')
        .upsert(favRows, { onConflict: 'user_id,word_id', ignoreDuplicates: true });
      if (!error) mergedVocabFavorites = favRows.length;
    }
  }

  // 6. Recompute user_stats + leaderboard from the merged exam history
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

  // This specific guest identity has now been consumed into `user.id` —
  // clear the cookie so it can never be merged again (e.g. into a second,
  // unrelated account created later on the same shared device). A fresh
  // guest identity is minted on demand the next time one is needed (guests
  // and signed-in visitors alike pick one up via ensureGuestIdentity()).
  const response = NextResponse.json({ ok: true, mergedExams: rows.length, mergedVocabKnown, mergedVocabFavorites });
  response.cookies.delete(GUEST_COOKIE);
  return response;
}
