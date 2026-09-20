import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { recordSeenQuestions } from '@/lib/question-history';

const MAX_IDS = 50;
const bodySchema = z.object({
  ids: z.array(z.uuid()).max(MAX_IDS),
});

/**
 * POST /api/practice/questions/mark-seen  { ids: string[] }
 * Pairs with GET /api/practice/questions?deferSeen=1 — a caller that
 * over-fetches candidate questions (the diagnostic asks for 10 per stage to
 * survive same-run overlap filtering, but only ever shows 3) calls this with
 * just the ids it actually displayed, so the rest stay available in the
 * shared pool instead of being burned for questions the user never saw.
 */
export async function POST(req: Request) {
  const { supabase, user, guestId } = await getServerClients();
  const userKey = user?.id ?? guestId ?? null;
  if (!userKey) return NextResponse.json({ error: 'No identity' }, { status: 401 });

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];

  await recordSeenQuestions(supabase, userKey, ids);
  return NextResponse.json({ ok: true, marked: ids.length });
}
