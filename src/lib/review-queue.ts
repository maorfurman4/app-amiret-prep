import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side equivalent of the wrong-answer branch in POST /api/review-queue,
 * for call sites (full exam completion) that don't have a client round-trip
 * per question — e.g. real exam answers are never sent back to the client
 * (anti-cheat), so this runs once at completion with the already-graded set.
 *
 * Each question is recorded via the record_wrong_review RPC (insert-or-
 * increment as one atomic Postgres statement) rather than a client-side
 * select-then-write, so two concurrent mistakes on the same question can
 * never race and silently drop one of them.
 */
export async function recordWrongAnswers(
  supabase: SupabaseClient,
  ownerCol: 'user_id' | 'guest_id',
  ownerVal: string,
  questionIds: string[],
) {
  const ownerType = ownerCol === 'user_id' ? 'user' : 'guest';
  for (const questionId of questionIds) {
    await supabase.rpc('record_wrong_review', {
      p_owner_type: ownerType,
      p_owner_id: ownerVal,
      p_question_id: questionId,
    });
  }
}
