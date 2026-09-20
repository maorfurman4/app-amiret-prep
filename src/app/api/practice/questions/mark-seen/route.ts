import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { recordSeenQuestions } from '@/lib/question-history';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 50;

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

  const body = await req.json().catch(() => ({})) as { ids?: unknown };
  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });
  }
  const ids = [...new Set(body.ids.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)))].slice(0, MAX_IDS);

  await recordSeenQuestions(supabase, userKey, ids);
  return NextResponse.json({ ok: true, marked: ids.length });
}
