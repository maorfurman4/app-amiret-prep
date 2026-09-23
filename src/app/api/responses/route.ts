import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { recordClientResponses } from '@/lib/responses';
import { applyResponsesToSrs } from '@/lib/srs';
import { estimateOwnerAbility } from '@/lib/ability';
import { calibrateItems } from '@/lib/calibration-server';
import { todayLocalStr } from '@/lib/date-local';

const MAX_RESPONSES = 25;
// An hour on one item is a tab left open, not a latency — reject rather
// than store a value that would poison pacing statistics.
const MAX_LATENCY_MS = 3_600_000;

const responseSchema = z.object({
  itemId: z.uuid(),
  // 'exam' is deliberately absent: exam responses are written server-side,
  // atomically with the section commit (see /api/exam/answer).
  context: z.enum(['practice', 'review', 'diagnostic']),
  chosenOption: z.int().min(0).max(3).nullable(),
  latencyMs: z.int().min(0).max(MAX_LATENCY_MS).nullable().optional(),
  confidence: z.int().min(1).max(3).nullable().optional(),
  thetaBefore: z.number().min(-4).max(4).nullable().optional(),
  sectionIndex: z.int().min(1).max(20).nullable().optional(),
});

const bodySchema = z.object({
  responses: z.array(responseSchema).min(1).max(MAX_RESPONSES),
});

/**
 * POST /api/responses  { responses: ClientResponseInput[] }
 * Logs answered items from the client-driven surfaces (practice, review
 * queue, diagnostic, today's session). `chosenOption` must be the canonical
 * stored index — clients map shuffled display positions back through
 * toCanonicalOption first. Correctness is graded here from the answer key;
 * the client never reports it.
 *
 * This is also the spaced-repetition entry point for those surfaces: every
 * logged answer is fed to its concept's FSRS card (src/lib/srs.ts). The
 * response log is the source of truth, so a scheduling failure is reported
 * but does not fail the request.
 *
 * It is also what keeps the streak: a day counts as active because the
 * server logged real answers on it — there is no client-reported "I did
 * some practice" endpoint any more.
 */
export async function POST(req: Request) {
  const { supabase, user, guestId } = await getServerClients();
  const ownerId = user?.id ?? guestId ?? null;
  if (!ownerId) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const owner = { id: ownerId, type: user ? 'user' as const : 'guest' as const };
  // Estimated BEFORE these answers are inserted, so neither p_correct nor
  // the item calibration below is judged against an ability that already
  // includes the very answers being judged.
  const ability = await estimateOwnerAbility(supabase, owner).catch(() => ({ theta: 0, n: 0 }));
  const { recorded, graded, error } = await recordClientResponses(supabase, owner, parsed.data.responses, ability.theta);
  if (error) return NextResponse.json({ error: 'Failed to record responses' }, { status: 500 });

  if (recorded > 0) {
    // Marks today active for the streak (no unit counts — the rings read
    // the responses log itself).
    const { error: dayErr } = await supabase.rpc('increment_daily_activity', {
      p_user_id: ownerId,
      p_activity_date: todayLocalStr(),
      p_source: parsed.data.responses[0].context,
      p_activity_units: 0,
      p_review_cleared: 0,
    });
    if (dayErr) console.error('[responses] streak day mark failed:', dayErr.message);
  }

  const srs = await applyResponsesToSrs(supabase, owner, graded)
    .catch((e: unknown) => ({ created: 0, reviewed: 0, error: String(e) }));
  if (srs.error) console.error('[responses] SRS update failed:', srs.error);

  const calibration = await calibrateItems(
    supabase,
    ability,
    graded.filter(g => Number.isFinite(g.responseId)).map(g => ({ responseId: g.responseId, type: g.type, latencyMs: g.latencyMs })),
  ).catch((e: unknown) => ({ updated: 0, skipped: null, error: String(e) }));
  if (calibration.error) console.error('[responses] item calibration failed:', calibration.error);

  return NextResponse.json({ ok: true, recorded, srs: { created: srs.created, reviewed: srs.reviewed } });
}
