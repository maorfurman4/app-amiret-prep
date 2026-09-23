import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';
import { examInstant } from '@/lib/fsrs';
import { recapCardsToExam } from '@/lib/srs';

const DEFAULT_DAILY_ACTIVITY_TARGET = 15;
/** Nobody books an AMIRNET sitting further out than this. */
const MAX_DAYS_AHEAD = 730;

const putSchema = z.object({
  // YYYY-MM-DD in Israel time, or null to clear.
  examDate: z.iso.date().nullable(),
});

/**
 * GET /api/goals → { examDate, dailyActivityTarget }
 * Accounts only — goals live on user_goals (FK to auth.users); a guest just
 * gets the defaults.
 */
export async function GET() {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ examDate: null, dailyActivityTarget: DEFAULT_DAILY_ACTIVITY_TARGET });

  const { data } = await supabase
    .from('user_goals')
    .select('exam_date, daily_activity_target')
    .eq('user_id', user.id)
    .maybeSingle();
  return NextResponse.json({
    examDate: (data?.exam_date as string | null) ?? null,
    dailyActivityTarget: (data?.daily_activity_target as number | null) ?? DEFAULT_DAILY_ACTIVITY_TARGET,
  });
}

/**
 * PUT /api/goals { examDate: 'YYYY-MM-DD' | null }
 * Sets (or clears) the exam date the spaced-repetition scheduler compresses
 * toward. Setting it immediately pulls every card that would come due after
 * the pre-exam window back into it (src/lib/srs.ts recapCardsToExam).
 */
export async function PUT(req: Request) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'Sign in to set an exam date' }, { status: 401 });

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { examDate } = parsed.data;

  if (examDate !== null) {
    const today = todayLocalStr();
    if (examDate < today || examDate > addLocalDays(today, MAX_DAYS_AHEAD)) {
      return NextResponse.json({ error: 'Exam date must be between today and two years from now' }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from('user_goals')
    .upsert({ user_id: user.id, exam_date: examDate, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save exam date' }, { status: 500 });

  const examAt = examInstant(examDate);
  if (examAt) {
    const recap = await recapCardsToExam(supabase, { id: user.id, type: 'user' }, examAt);
    if (recap.error) console.error('[goals] exam recap failed:', recap.error);
  }

  return NextResponse.json({ ok: true, examDate });
}
