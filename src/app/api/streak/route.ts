import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { computeStreak } from '@/lib/streak-server';

/**
 * GET /api/streak?guestId=xxx
 * See lib/streak-server.ts for the streak definition. Kept as its own
 * endpoint (rather than folded entirely into /api/dashboard-summary) in
 * case another page needs just the streak without the rest of the
 * dashboard payload.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  const guestId = req.nextUrl.searchParams.get('guestId');
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json({ streak: 0 });

  const streak = await computeStreak(supabase, owner);
  return NextResponse.json({ streak });
}
