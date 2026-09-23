import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import type { Question } from '@/types/exam';
import { recordWrongAnswers } from '@/lib/review-queue';
import { shuffleAllOptions } from '@/lib/option-shuffle';

const MAX_INTERVAL_DAYS = 30;

/**
 * GET /api/review-queue?guestId=xxx
 * Returns due questions (next_review_at <= now()) with full question data.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();

  if (!user && !guestId) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  const now = new Date().toISOString();

  let q = supabase
    .from('review_queue')
    .select('question_id, times_wrong, interval_days')
    .lte('next_review_at', now)
    .order('next_review_at', { ascending: true });

  q = user ? q.eq('user_id', user.id) : q.eq('guest_id', guestId!);

  const { data: queueItems, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!queueItems || queueItems.length === 0) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  const questionIds = queueItems.map(item => item.question_id);

  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  // Fetch passages for RC questions
  const passageIds = [...new Set(
    (questions ?? [])
      .filter(q => q.passage_id)
      .map(q => q.passage_id as string)
  )];

  let passageMap: Record<string, { id: string; text: string; difficulty_level: number; b: number }> = {};

  if (passageIds.length > 0) {
    const { data: passages } = await supabase
      .from('passages')
      .select('id, text, difficulty_level, b')
      .in('id', passageIds);

    passageMap = Object.fromEntries((passages ?? []).map(p => [p.id, p]));
  }

  const enriched: Question[] = (questions ?? []).map(q => ({
    ...q,
    passage: q.passage_id ? passageMap[q.passage_id] : undefined,
  })) as Question[];

  // Preserve queue order (by next_review_at)
  const ordered = questionIds
    .map(id => enriched.find(q => q.id === id))
    .filter(Boolean) as Question[];

  // Fresh option order on every review, so a re-seen mistake can't be
  // "remembered" by its position (see src/lib/option-shuffle.ts).
  return NextResponse.json({ questions: shuffleAllOptions(ordered), count: ordered.length });
}

/**
 * DELETE /api/review-queue?guestId=xxx                     — clear all (restart)
 * DELETE /api/review-queue?guestId=xxx&questionId=yyy      — remove one question
 * DELETE /api/review-queue?guestId=xxx&type=sentence_completion — remove all
 *   queued questions of one question type (category)
 */
export async function DELETE(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  const questionId = req.nextUrl.searchParams.get('questionId');
  const type = req.nextUrl.searchParams.get('type');

  if (!user && !guestId) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  const ownCol = user ? 'user_id' : 'guest_id';
  const ownVal = user ? user.id : guestId!;

  if (type) {
    const { data: owned } = await supabase
      .from('review_queue').select('question_id').eq(ownCol, ownVal);
    const ownedIds = (owned ?? []).map(r => r.question_id as string);
    if (ownedIds.length === 0) return NextResponse.json({ ok: true });

    const { data: matching } = await supabase
      .from('questions').select('id').eq('type', type).in('id', ownedIds);
    const matchingIds = (matching ?? []).map(r => r.id as string);
    if (matchingIds.length === 0) return NextResponse.json({ ok: true });

    const { error } = await supabase
      .from('review_queue').delete().eq(ownCol, ownVal).in('question_id', matchingIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  let q = supabase.from('review_queue').delete().eq(ownCol, ownVal);
  if (questionId) q = q.eq('question_id', questionId);

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/review-queue
 * Body: { guestId, questionId, wasCorrect }
 * - Wrong answer: upsert into queue with interval_days=1
 * - Correct in review: double interval or remove if graduated
 */
export async function POST(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();

  let body: { guestId?: string; questionId: string; wasCorrect: boolean };
  try {
    body = await req.json() as { guestId?: string; questionId: string; wasCorrect: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { questionId, wasCorrect } = body;

  if (!questionId || (!user && !guestId)) {
    return NextResponse.json({ error: 'questionId required' }, { status: 400 });
  }

  const ownCol = user ? 'user_id' : 'guest_id';
  const ownVal = user ? user.id : guestId!;
  const ownerType = user ? 'user' : 'guest';

  if (!wasCorrect) {
    // A fresh mistake is due immediately (Anki-style): the user can review it
    // right away; spaced intervals kick in only after a correct review.
    await recordWrongAnswers(supabase, ownCol, ownVal, [questionId]);
    return NextResponse.json({ ok: true, action: 'added_or_updated' });
  }

  // Doubles the existing interval (or graduates it at the cap) as one
  // atomic Postgres statement — see record_correct_review's own comment
  // for why a client-side select-then-update can't safely do this under
  // concurrent submissions for the same question.
  const { data, error } = await supabase.rpc('record_correct_review', {
    p_owner_type: ownerType,
    p_owner_id: ownVal,
    p_question_id: questionId,
    p_max_interval_days: MAX_INTERVAL_DAYS,
  }).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { action, new_interval: newInterval } = data as { action: string; new_interval: number | null };
  return NextResponse.json({ ok: true, action, ...(newInterval !== null ? { newInterval } : {}) });
}
