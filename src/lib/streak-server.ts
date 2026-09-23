import type { createServerSupabaseClient } from '@/lib/supabase-server';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Streak = consecutive local (Israel) calendar days with at least one
 * completed exam/practice/diagnostic session, ending today or yesterday
 * (grace period so the flame survives until tonight). Server-computed
 * from activity_log so it isn't tied to any single device's local storage.
 *
 * Extracted from /api/streak so /api/dashboard-summary can compute the
 * same number in one round trip instead of a second network call.
 */
export interface StreakInfo {
  streak: number;
  hasActivityToday: boolean;
}

/**
 * Same query as computeStreak, but also reports whether today already has
 * an activity_log row — /api/dashboard-summary uses this to show the
 * streak-at-risk flame variant without a second round trip.
 */
export async function computeStreakInfo(supabase: SupabaseClient, owner: string): Promise<StreakInfo> {
  const { data: rows } = await supabase
    .from('activity_log')
    .select('activity_date')
    .eq('user_id', owner);

  const days = new Set((rows ?? []).map(r => r.activity_date as string));
  const today = todayLocalStr();
  const hasActivityToday = days.has(today);

  let cursor = today;
  if (!hasActivityToday) cursor = addLocalDays(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addLocalDays(cursor, -1);
  }

  return { streak, hasActivityToday };
}

export async function computeStreak(supabase: SupabaseClient, owner: string): Promise<number> {
  return (await computeStreakInfo(supabase, owner)).streak;
}
