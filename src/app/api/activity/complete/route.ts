import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

const TZ = 'Asia/Jerusalem';

/**
 * POST /api/activity/complete
 * Records "this user finished a session today" for streak purposes.
 * Exam completions are recorded inline in /api/exam/answer; this endpoint
 * covers practice and diagnostic, which aren't persisted to exam_sessions.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  let body: { guestId?: string; source?: string };
  try {
    body = await req.json() as { guestId?: string; source?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const owner = user?.id ?? body.guestId;
  if (!owner) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

  await supabase
    .from('activity_log')
    .upsert({ user_id: owner, activity_date: today, source: body.source ?? 'unknown' }, { onConflict: 'user_id,activity_date', ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
