import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { recordClientResponses } from '@/lib/responses';

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

  const { recorded, error } = await recordClientResponses(
    supabase,
    { id: ownerId, type: user ? 'user' : 'guest' },
    parsed.data.responses,
  );
  if (error) return NextResponse.json({ error: 'Failed to record responses' }, { status: 500 });

  return NextResponse.json({ ok: true, recorded });
}
