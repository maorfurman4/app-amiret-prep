import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';
import { predictionBefore } from '@/lib/official-score';

/** Sittings older than this are too stale to anchor the current model. */
const MAX_DAYS_BACK = 730;

const bodySchema = z.object({
  score: z.int().min(50).max(150),
  testDate: z.iso.date(),
  testType: z.enum(['amirnet', 'amiram', 'psychometric']).default('amirnet'),
});

/**
 * PUT /api/official-score { score, testDate, testType }
 * Records a student's official NITE score for one sitting, alongside the
 * app's pre-test prediction (src/lib/official-score.ts). Re-reporting the
 * same sitting corrects the score but keeps the original prediction
 * snapshot — it must reflect what the app said *before* the test, not
 * after later calibration moved things. Accounts only.
 */
export async function PUT(req: Request) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'Sign in to report a score' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { score, testDate, testType } = parsed.data;

  const today = todayLocalStr();
  if (testDate > today || testDate < addLocalDays(today, -MAX_DAYS_BACK)) {
    return NextResponse.json({ error: 'Test date must be in the past two years' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('official_scores')
    .select('id, app_score, app_p_exempt')
    .eq('user_id', user.id)
    .eq('test_date', testDate)
    .maybeSingle();

  let prediction: { app_score: number | null; app_p_exempt: number | null };
  if (existing) {
    const { error } = await supabase
      .from('official_scores')
      .update({ score, test_type: testType, reported_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
    prediction = existing as typeof prediction;
  } else {
    const snapshot = await predictionBefore(supabase, user.id, testDate);
    const { error } = await supabase
      .from('official_scores')
      .insert({ user_id: user.id, score, test_date: testDate, test_type: testType, ...snapshot });
    if (error) return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
    prediction = snapshot;
  }

  return NextResponse.json({
    ok: true,
    score,
    prediction: prediction.app_score === null ? null : { score: prediction.app_score, pExempt: prediction.app_p_exempt },
  });
}
