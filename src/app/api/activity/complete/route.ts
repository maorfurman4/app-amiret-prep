import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { todayLocalStr } from '@/lib/date-local';

/**
 * POST /api/activity/complete
 * Records "this user finished a session today" for streak purposes, and
 * accumulates how many questions/items it covered for Ring A ("today's
 * practice"). Exam completions are recorded inline in commit_exam_section;
 * this endpoint covers practice/today/diagnostic, which aren't persisted
 * to exam_sessions.
 */
export async function POST(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  let body: { guestId?: string; source?: string; units?: number };
  try {
    body = await req.json() as { guestId?: string; source?: string; units?: number };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const units = Number.isFinite(body.units) && (body.units as number) > 0 ? Math.floor(body.units as number) : 1;

  await supabase.rpc('increment_daily_activity', {
    p_user_id: owner,
    p_activity_date: todayLocalStr(),
    p_source: body.source ?? 'unknown',
    p_activity_units: units,
  });

  return NextResponse.json({ ok: true });
}
