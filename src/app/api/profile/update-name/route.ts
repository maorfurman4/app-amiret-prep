import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * POST /api/profile/update-name
 * Body: { displayName: string }
 * Updates user_stats.display_name (creating the row if the user has no
 * exam history yet — most columns there have defaults) and, if a
 * leaderboard row already exists for this user, keeps it in sync too.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: { displayName?: string };
  try {
    body = await req.json() as { displayName?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const displayName = (body.displayName ?? '').trim().slice(0, 40);
  if (!displayName) return NextResponse.json({ error: 'שם תצוגה לא יכול להיות ריק' }, { status: 400 });

  const { error } = await supabase
    .from('user_stats')
    .upsert({ user_id: user.id, display_name: displayName }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('leaderboard').update({ display_name: displayName }).eq('user_id', user.id);

  return NextResponse.json({ ok: true, displayName });
}
