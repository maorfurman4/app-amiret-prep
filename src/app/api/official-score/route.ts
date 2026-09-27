import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';
import { predictionBefore, SCORE_SOURCES } from '@/lib/official-score';

/** Sittings older than this are too stale to anchor the current model. */
const MAX_DAYS_BACK = 730;
/** At most this many saves per student per minute (a save sets reported_at). */
const RATE_LIMIT_PER_MINUTE = 5;

const bodySchema = z.object({
  score: z.int().min(50).max(150),
  testDate: z.iso.date(),
  testType: z.enum(['amirnet', 'amiram', 'psychometric']).default('amirnet'),
  // Which entry point asked; the exam-date prompt predates the field.
  source: z.enum(SCORE_SOURCES).default('exam_date_prompt'),
});

/**
 * PUT /api/official-score { score, testDate, testType, source }
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
  const { score, testDate, testType, source } = parsed.data;

  const today = todayLocalStr();
  if (testDate > today || testDate < addLocalDays(today, -MAX_DAYS_BACK)) {
    return NextResponse.json({ error: 'Test date must be in the past two years' }, { status: 400 });
  }

  const { count: recent } = await supabase
    .from('official_scores')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('reported_at', new Date(Date.now() - 60_000).toISOString());
  if ((recent ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: 'Too many saves, try again in a minute' }, { status: 429 });
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
      .insert({ user_id: user.id, score, test_date: testDate, test_type: testType, source, ...snapshot });
    if (error) return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
    prediction = snapshot;
  }

  return NextResponse.json({
    ok: true,
    score,
    prediction: prediction.app_score === null ? null : { score: prediction.app_score, pExempt: prediction.app_p_exempt },
  });
}

/**
 * GET /api/official-score
 * The student's own reports (newest sitting first) and what the general
 * entry points need to decide whether to ask: completed timed exams and the
 * last general "prefer not to". Accounts only.
 */
export async function GET() {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const [scores, goals, exams] = await Promise.all([
    supabase.from('official_scores')
      .select('id, test_type, score, test_date, app_score, source')
      .eq('user_id', user.id)
      .order('test_date', { ascending: false }),
    supabase.from('user_goals').select('score_prompt_dismissed_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('exam_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_practice', false)
      .not('completed_at', 'is', null),
  ]);
  if (scores.error) return NextResponse.json({ error: 'Failed to load' }, { status: 500 });

  return NextResponse.json({
    scores: scores.data ?? [],
    dismissedAt: (goals.data as { score_prompt_dismissed_at: string | null } | null)?.score_prompt_dismissed_at ?? null,
    completedExams: exams.count ?? 0,
  });
}

/**
 * DELETE /api/official-score?id=123
 * Removes one of the student's own reports. Accounts only.
 */
export async function DELETE(req: Request) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { error, count } = await supabase
    .from('official_scores')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
