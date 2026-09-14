import type { createServerSupabaseClient } from '@/lib/supabase-server';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const TZ = 'Asia/Jerusalem';

function todayLocalStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak = consecutive local (Israel) calendar days with at least one
 * completed exam/practice/diagnostic session, ending today or yesterday
 * (grace period so the flame survives until tonight). Server-computed
 * from activity_log so it isn't tied to any single device's local storage.
 *
 * Extracted from /api/streak so /api/dashboard-summary can compute the
 * same number in one round trip instead of a second network call.
 */
export async function computeStreak(supabase: SupabaseClient, owner: string): Promise<number> {
  const { data: rows } = await supabase
    .from('activity_log')
    .select('activity_date')
    .eq('user_id', owner);

  const days = new Set((rows ?? []).map(r => r.activity_date as string));

  let cursor = todayLocalStr();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}
