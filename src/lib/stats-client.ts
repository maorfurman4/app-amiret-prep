import { authFetch } from './auth-fetch';
import type { StatsRow } from './stats-metrics';
import type { ErrorCauseBreakdown, PracticeActivity } from './practice-activity';

export interface StatsActivity {
  practice: PracticeActivity;
  errorCauses: ErrorCauseBreakdown;
}

/**
 * The practice-activity counts and tagged-error breakdown behind the two
 * extra stats widgets. Additive and optional: a failed read returns null so
 * the widgets simply don't render — it never blocks the exam-based page.
 */
export async function fetchStatsActivity(): Promise<StatsActivity | null> {
  try {
    const res = await authFetch('/api/stats/activity');
    if (!res.ok) return null;
    return await res.json() as StatsActivity;
  } catch {
    return null;
  }
}

/**
 * The one client read behind every stats number: /stats and the profile
 * header both fetch their rows here and run them through computeStatsMetrics,
 * so the two can never disagree.
 */
export async function fetchStatsRows(): Promise<StatsRow[]> {
  let guestId = '';
  try { guestId = localStorage.getItem('amiret_guest_id') ?? ''; } catch { /* storage disabled */ }
  const res = await authFetch(`/api/stats?guestId=${encodeURIComponent(guestId)}`);
  if (!res.ok) throw new Error(`stats fetch failed: ${res.status}`);
  const data = await res.json() as { sessions?: StatsRow[] };
  return data.sessions ?? [];
}
