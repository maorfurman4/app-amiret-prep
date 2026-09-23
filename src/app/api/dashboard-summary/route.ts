import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { computeStreakInfo } from '@/lib/streak-server';
import { computeForecast, type Forecast } from '@/lib/forecast';
import { computeRings, DEFAULT_EFFORT_TARGET, type Rings } from '@/lib/rings';

const VICTORY_PATH_TARGET_SCORE = 134;

export interface DashboardSummary {
  streak: number;
  lastScore: number | null;
  examCount: number;
  reviewDueCount: number;
  todayDueCount: number;
  hasActivityToday: boolean;
  /** Server-derived learning rings (src/lib/rings.ts). */
  rings: Rings;
  /** The account's exam date (YYYY-MM-DD), null if unset or a guest. */
  examDate: string | null;
  /** Only accounts can store an exam date (user_goals → auth.users). */
  canSetExamDate: boolean;
  forecast: Forecast | null;
}

const EMPTY: DashboardSummary = {
  streak: 0,
  lastScore: null,
  examCount: 0,
  reviewDueCount: 0,
  todayDueCount: 0,
  hasActivityToday: false,
  rings: {
    effort: { done: 0, target: DEFAULT_EFFORT_TARGET },
    retention: { done: 0, due: 0 },
    simulation: { done: false },
  },
  examDate: null,
  canSetExamDate: false,
  forecast: null,
};

/**
 * GET /api/dashboard-summary?guestId=xxx
 *
 * Purpose-built, minimal-payload aggregate for the home page. Deliberately
 * NOT a reuse of /api/stats (which returns every completed session incl.
 * the section_results JSONB blob — far more than a homepage badge needs)
 * or /api/review-queue (which joins full question data just to show a
 * count). Every query here is either a `head: true` count or a
 * single-row select, so this is the cheapest possible read for what the
 * home page actually renders. One round trip instead of three.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const owner = user?.id ?? guestId;
  if (!owner) return NextResponse.json(EMPTY);

  const now = new Date().toISOString();

  // Due FSRS concept cards (one per concept, however many questions test it).
  const reviewQuery = supabase
    .from('srs_cards')
    .select('id', { count: 'exact', head: true })
    .eq('owner_type', user ? 'user' : 'guest')
    .eq('owner_id', owner)
    .lte('due_at', now);

  // Vocab spaced-repetition only exists for signed-in users (user_vocab_known
  // has no guest_id column — guest known/favorites are localStorage-only).
  const vocabDueQuery = user
    ? supabase
        .from('user_vocab_known')
        .select('word_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('next_review_at', now)
    : null;

  const goalQuery = user
    ? supabase.from('user_goals').select('daily_activity_target, exam_date').eq('user_id', user.id).maybeSingle()
    : null;

  const [streakInfo, lastScoreRes, forecastRowsRes, examCountRes, reviewCountRes, vocabDueRes, goalRes] = await Promise.all([
    computeStreakInfo(supabase, owner),
    supabase
      .from('exam_sessions')
      .select('score')
      .eq('user_id', owner)
      .eq('is_practice', false)
      .not('completed_at', 'is', null)
      .not('score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Same shape /api/stats fetches for the full Victory Path chart, minus
    // section_results — the home page only needs the compact headline, not
    // the full chart, but the forecast math needs the whole score history.
    supabase
      .from('exam_sessions')
      .select('score, completed_at')
      .eq('user_id', owner)
      .eq('is_practice', false)
      .not('completed_at', 'is', null)
      .not('score', 'is', null)
      .order('completed_at', { ascending: true }),
    supabase
      .from('exam_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', owner)
      .eq('is_practice', false)
      .not('completed_at', 'is', null)
      .not('score', 'is', null),
    reviewQuery,
    vocabDueQuery,
    goalQuery,
  ]);

  const reviewDueCount = reviewCountRes.count ?? 0;
  const vocabDueCount = vocabDueRes?.count ?? 0;
  const goal = goalRes?.data as { daily_activity_target?: number | null; exam_date?: string | null } | null | undefined;

  const rings = await computeRings(supabase, { id: owner, type: user ? 'user' : 'guest' }, {
    effortTarget: goal?.daily_activity_target ?? DEFAULT_EFFORT_TARGET,
    dueNow: reviewDueCount,
  });

  return NextResponse.json({
    streak: streakInfo.streak,
    lastScore: lastScoreRes.data?.score ?? null,
    examCount: examCountRes.count ?? 0,
    reviewDueCount,
    todayDueCount: reviewDueCount + vocabDueCount,
    hasActivityToday: streakInfo.hasActivityToday,
    rings,
    examDate: goal?.exam_date ?? null,
    canSetExamDate: !!user,
    forecast: computeForecast(forecastRowsRes.data ?? [], VICTORY_PATH_TARGET_SCORE),
  } satisfies DashboardSummary);
}
