import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { computeStreakInfo } from '@/lib/streak-server';

/**
 * GET /api/streak
 * See lib/streak-server.ts for the streak definition. Kept as its own
 * endpoint (rather than folded entirely into /api/dashboard-summary) so a
 * session's completion screen can ask whether today just started counting
 * without loading the rest of the dashboard payload.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ streak: 0, hasActivityToday: false });

  return NextResponse.json(await computeStreakInfo(supabase, owner));
}
