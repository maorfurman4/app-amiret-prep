import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';

const bodySchema = z.object({ testDate: z.iso.date() });

/**
 * POST /api/official-score/dismiss { testDate }
 * "Prefer not to share" for one sitting: the dashboard stops asking about
 * that exam date (setting a new exam date asks again after it passes).
 */
export async function POST(req: Request) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { error } = await supabase
    .from('user_goals')
    .upsert({ user_id: user.id, score_prompt_dismissed_for: parsed.data.testDate, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
