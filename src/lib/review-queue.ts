import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side equivalent of the wrong-answer branch in POST /api/review-queue,
 * for call sites (full exam completion) that don't have a client round-trip
 * per question — e.g. real exam answers are never sent back to the client
 * (anti-cheat), so this runs once at completion with the already-graded set.
 */
export async function recordWrongAnswers(
  supabase: SupabaseClient,
  ownerCol: 'user_id' | 'guest_id',
  ownerVal: string,
  questionIds: string[],
) {
  const now = new Date().toISOString();
  for (const questionId of questionIds) {
    const { data: existing } = await supabase
      .from('review_queue')
      .select('times_wrong')
      .eq(ownerCol, ownerVal)
      .eq('question_id', questionId)
      .single();

    if (existing) {
      await supabase
        .from('review_queue')
        .update({
          times_wrong: (existing as { times_wrong: number }).times_wrong + 1,
          next_review_at: now,
          last_reviewed_at: now,
          interval_days: 1,
        })
        .eq(ownerCol, ownerVal)
        .eq('question_id', questionId);
    } else {
      await supabase.from('review_queue').insert({
        [ownerCol]: ownerVal,
        question_id: questionId,
        times_wrong: 1,
        next_review_at: now,
        last_reviewed_at: now,
        interval_days: 1,
      });
    }
  }
}
