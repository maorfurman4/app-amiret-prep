import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

const TZ = 'Asia/Jerusalem';

function todayLocalStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/streak?guestId=xxx
 * Streak = consecutive local (Israel) calendar days with at least one
 * completed exam/practice/diagnostic session, ending today or yesterday
 * (grace period so the flame survives until tonight). Server-computed
 * from activity_log so it isn't tied to any single device's local storage.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  const guestId = req.nextUrl.searchParams.get('guestId');
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ streak: 0 });

  const { data: rows } = await supabase
    .from('activity_log')
    .select('activity_date')
    .eq('user_id', owner);

  const days = new Set((rows ?? []).map(r => r.activity_date as string));

  let cursor = todayLocalStr();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return NextResponse.json({ streak });
}
