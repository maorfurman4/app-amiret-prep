import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { shuffleAllOptions } from '@/lib/option-shuffle';
import { selectDueReviewQuestions } from '@/lib/srs';

/**
 * GET /api/review-queue
 * Everything due for spaced review, one question per due concept card:
 * a sibling question testing the same concept when one is available,
 * otherwise the question that created the card (see src/lib/srs.ts).
 *
 * Answers are not posted here: every surface logs answers to
 * /api/responses, which grades them and updates the FSRS cards.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const ownerId = user?.id ?? guestId;
  if (!ownerId) return NextResponse.json({ questions: [], count: 0 });

  const { questions, error } = await selectDueReviewQuestions(supabase, { id: ownerId, type: user ? 'user' : 'guest' });
  if (error) return NextResponse.json({ error }, { status: 500 });

  // Fresh option order on every review, so a resurfaced item can't be
  // "remembered" by its position (see src/lib/option-shuffle.ts).
  return NextResponse.json({ questions: shuffleAllOptions(questions), count: questions.length });
}

/**
 * DELETE /api/review-queue                                 — clear all cards
 * DELETE /api/review-queue?questionId=yyy                  — remove the card
 *   for that question's concept (the served question may be a sibling of
 *   the one that created the card; both map to the same concept)
 * DELETE /api/review-queue?type=sentence_completion        — remove every
 *   card of one question type (category)
 */
export async function DELETE(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  const ownerId = user?.id ?? guestId;
  if (!ownerId) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const questionId = req.nextUrl.searchParams.get('questionId');
  const type = req.nextUrl.searchParams.get('type');

  let conceptKey: string | null = null;
  if (questionId) {
    const { data: item } = await supabase.from('questions').select('concept_key').eq('id', questionId).maybeSingle();
    if (!item) return NextResponse.json({ ok: true });
    conceptKey = item.concept_key as string;
  }

  let q = supabase
    .from('srs_cards')
    .delete()
    .eq('owner_type', user ? 'user' : 'guest')
    .eq('owner_id', ownerId);

  if (conceptKey) {
    q = q.eq('concept_key', conceptKey);
  } else if (type) {
    q = q.eq('item_type', type);
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
