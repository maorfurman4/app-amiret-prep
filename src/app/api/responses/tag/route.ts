import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { ERROR_CAUSES } from '@/lib/error-cause';

/**
 * POST /api/responses/tag
 *   { clientRef, cause }            — a row logged from the browser
 *   { sessionId, itemId, cause }    — an exam row (written server-side)
 * cause: 'vocab' | 'logic' | 'time' | 'careless', or null to clear.
 *
 * Tags only the caller's own, wrong answers. 409 means no matching row yet —
 * the fire-and-forget log may still be in flight, so the client retries once.
 */
const causeSchema = z.enum(ERROR_CAUSES).nullable();
const bodySchema = z.union([
  z.object({ clientRef: z.uuid(), cause: causeSchema }),
  z.object({ sessionId: z.uuid(), itemId: z.uuid(), cause: causeSchema }),
]);

export async function POST(req: Request) {
  const { supabase, user, guestId } = await getServerClients();
  const ownerId = user?.id ?? guestId ?? null;
  if (!ownerId) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const body = parsed.data;

  let query = supabase
    .from('responses')
    .update({ error_cause: body.cause, error_tagged_at: body.cause ? new Date().toISOString() : null })
    .eq('owner_id', ownerId)
    .eq('correct', false);
  query = 'clientRef' in body
    ? query.eq('client_ref', body.clientRef)
    : query.eq('session_id', body.sessionId).eq('item_id', body.itemId);

  const { data, error } = await query.select('id');
  if (error) return NextResponse.json({ error: 'Failed to tag response' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Response not found' }, { status: 409 });
  return NextResponse.json({ tagged: data.length, cause: body.cause });
}
