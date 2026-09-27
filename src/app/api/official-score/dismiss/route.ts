import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';

// Either one sitting (the exam-date prompt) or the general entry points.
const bodySchema = z.union([z.object({ testDate: z.iso.date() }), z.object({ scope: z.literal('general') })]);

/**
 * POST /api/official-score/dismiss { testDate } | { scope: 'general' }
 * "Prefer not to share". With a testDate: the dashboard stops asking about
 * that exam date (setting a new exam date asks again after it passes).
 * With scope general: the results-page line stops asking for 60 days.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const now = new Date().toISOString();
  const fields = 'testDate' in parsed.data
    ? { score_prompt_dismissed_for: parsed.data.testDate }
    : { score_prompt_dismissed_at: now };
  const { error } = await supabase
    .from('user_goals')
    .upsert({ user_id: user.id, ...fields, updated_at: now }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
