import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { computeStreakInfo } from '@/lib/streak-server';
import { todayLocalStr } from '@/lib/date-local';
import { computeForecast, type Forecast } from '@/lib/forecast';

const DEFAULT_DAILY_ACTIVITY_TARGET = 15;
const VICTORY_PATH_TARGET_SCORE = 134;

export interface DashboardSummary {
  streak: number;
  lastScore: number | null;
  examCount: number;
  reviewDueCount: number;
  todayDueCount: number;
  hasActivityToday: boolean;
  activityUnitsToday: number;
  reviewClearedToday: number;
  dailyActivityTarget: number;
  forecast: Forecast | null;
}

const EMPTY: DashboardSummary = {
  streak: 0,
  lastScore: null,
  examCount: 0,
  reviewDueCount: 0,
  todayDueCount: 0,
  hasActivityToday: false,
  activityUnitsToday: 0,
  reviewClearedToday: 0,
  dailyActivityTarget: DEFAULT_DAILY_ACTIVITY_TARGET,
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
  const today = todayLocalStr();

  let reviewQuery = supabase
    .from('review_queue')
    .select('id', { count: 'exact', head: true })
    .lte('next_review_at', now);
  reviewQuery = user ? reviewQuery.eq('user_id', user.id) : reviewQuery.eq('guest_id', guestId!);

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
    ? supabase.from('user_goals').select('daily_activity_target').eq('user_id', user.id).maybeSingle()
    : null;

  const [streakInfo, lastScoreRes, forecastRowsRes, examCountRes, reviewCountRes, vocabDueRes, todayRowRes, goalRes] = await Promise.all([
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
    supabase
      .from('activity_log')
      .select('activity_units, review_cleared')
      .eq('user_id', owner)
      .eq('activity_date', today)
      .maybeSingle(),
    goalQuery,
  ]);

  const reviewDueCount = reviewCountRes.count ?? 0;
  const vocabDueCount = vocabDueRes?.count ?? 0;

  return NextResponse.json({
    streak: streakInfo.streak,
    lastScore: lastScoreRes.data?.score ?? null,
    examCount: examCountRes.count ?? 0,
    reviewDueCount,
    todayDueCount: reviewDueCount + vocabDueCount,
    hasActivityToday: streakInfo.hasActivityToday,
    activityUnitsToday: todayRowRes.data?.activity_units ?? 0,
    reviewClearedToday: todayRowRes.data?.review_cleared ?? 0,
    dailyActivityTarget: goalRes?.data?.daily_activity_target ?? DEFAULT_DAILY_ACTIVITY_TARGET,
    forecast: computeForecast(forecastRowsRes.data ?? [], VICTORY_PATH_TARGET_SCORE),
  } satisfies DashboardSummary);
}
