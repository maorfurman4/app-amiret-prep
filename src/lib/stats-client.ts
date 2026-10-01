import { authFetch } from './auth-fetch';
import type { StatsRow } from './stats-metrics';

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
