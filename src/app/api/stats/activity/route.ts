import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { aggregateErrorCauses, computePracticeActivity } from '@/lib/practice-activity';

/**
 * GET /api/stats/activity
 * The practice-activity counts and tagged-error breakdown for the stats page.
 * Owner-scoped exactly like /api/stats: responses has no SELECT policy for
 * guests, so the service-role client enforces "only your own rows" here via
 * owner_id — never a client-supplied id.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId;
  // No identity → the same empty shape the page renders as "nothing yet".
  if (!owner) {
    return NextResponse.json({ practice: computePracticeActivity([]), errorCauses: aggregateErrorCauses([]) });
  }

  const [activity, errors] = await Promise.all([
    // 'review' counts as practice activity: answering the review queue is the
    // student doing questions, same as practice mode.
    supabase.from('responses').select('created_at').eq('owner_id', owner).in('context', ['practice', 'review']),
    supabase.from('responses').select('error_cause').eq('owner_id', owner).eq('correct', false).not('error_cause', 'is', null),
  ]);
  // An empty result reads as "no activity" — a failed read must not.
  if (activity.error || errors.error) return NextResponse.json({ error: 'stats unavailable' }, { status: 503 });

  return NextResponse.json({
    practice: computePracticeActivity(activity.data ?? []),
    errorCauses: aggregateErrorCauses(errors.data ?? []),
  });
}
