import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import type { Question } from '@/types/exam';

function nextInterval(currentDays: number): number {
  const doubled = Math.max(currentDays, 1) * 2;
  return Math.min(doubled, 30);
}

/**
 * GET /api/review-queue?guestId=xxx
 * Returns due questions (next_review_at <= now()) with full question data.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  const guestId = req.nextUrl.searchParams.get('guestId');

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

  return NextResponse.json({ questions: ordered, count: ordered.length });
}

/**
 * DELETE /api/review-queue?guestId=xxx              — clear all (restart)
 * DELETE /api/review-queue?guestId=xxx&questionId=yyy — remove one question
 */
export async function DELETE(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  const guestId = req.nextUrl.searchParams.get('guestId');
  const questionId = req.nextUrl.searchParams.get('questionId');

  if (!user && !guestId) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  const ownCol = user ? 'user_id' : 'guest_id';
  const ownVal = user ? user.id : guestId!;

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
  const { supabase, user } = await getServerClients();

  let body: { guestId?: string; questionId: string; wasCorrect: boolean };
  try {
    body = await req.json() as { guestId?: string; questionId: string; wasCorrect: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { guestId, questionId, wasCorrect } = body;

  if (!questionId || (!user && !guestId)) {
    return NextResponse.json({ error: 'questionId required' }, { status: 400 });
  }

  const now = new Date();
  const ownCol = user ? 'user_id' : 'guest_id';
  const ownVal = user ? user.id : guestId!;
  const insertBase = user
    ? { user_id: user.id, question_id: questionId }
    : { guest_id: guestId!, question_id: questionId };

  if (!wasCorrect) {
    const { data: existing } = await supabase
      .from('review_queue').select('times_wrong')
      .eq(ownCol, ownVal).eq('question_id', questionId).single();

    // A fresh mistake is due immediately (Anki-style): the user can review it
    // right away; spaced intervals kick in only after a correct review.
    const nextReview = new Date(now);

    if (existing) {
      await supabase.from('review_queue')
        .update({
          times_wrong: (existing as { times_wrong: number }).times_wrong + 1,
          next_review_at: nextReview.toISOString(),
          last_reviewed_at: now.toISOString(),
          interval_days: 1,
        })
        .eq(ownCol, ownVal).eq('question_id', questionId);
    } else {
      await supabase.from('review_queue').insert({
        ...insertBase,
        times_wrong: 1,
        next_review_at: nextReview.toISOString(),
        last_reviewed_at: now.toISOString(),
        interval_days: 1,
      });
    }
    return NextResponse.json({ ok: true, action: 'added_or_updated' });
  }

  const { data: existing } = await supabase
    .from('review_queue').select('interval_days, times_wrong')
    .eq(ownCol, ownVal).eq('question_id', questionId).single();

  if (!existing) return NextResponse.json({ ok: true, action: 'not_in_queue' });

  const { interval_days, times_wrong } = existing as { interval_days: number; times_wrong: number };
  const newInterval = nextInterval(interval_days);

  if (newInterval >= 30) {
    await supabase.from('review_queue').delete().eq(ownCol, ownVal).eq('question_id', questionId);
    return NextResponse.json({ ok: true, action: 'graduated' });
  }

  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + newInterval);

  await supabase.from('review_queue')
    .update({ interval_days: newInterval, next_review_at: nextReview.toISOString(), last_reviewed_at: now.toISOString() })
    .eq(ownCol, ownVal).eq('question_id', questionId);

  return NextResponse.json({ ok: true, action: 'interval_extended', newInterval });
}
