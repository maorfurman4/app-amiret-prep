export interface TrendSession {
  score: number;
  completed_at: string;
}

export interface Trend {
  /** Least-squares points/day over completed_at deltas — calendar-day
   * velocity, not points-per-exam (see below for why). */
  slopePerDay: number;
  /** The latest exam's actual score. */
  currentScore: number;
}

const MS_PER_DAY = 86_400_000;

/** Below this, a trend line is fit to noise, not signal. */
export const MIN_SESSIONS = 4;
const MIN_DISTINCT_DAYS = 3;

/** A slope below this reads as "flat", not as improvement. */
export const MIN_MEANINGFUL_SLOPE = 0.01;

/**
 * The score trend on /stats: points per *day* (real date deltas between
 * completed_at timestamps), not per exam — someone who takes 5 exams in
 * one afternoon hasn't improved 5x faster.
 *
 * Describes the past only. It deliberately doesn't project a date for
 * reaching 134: a straight line through a handful of noisy, uncalibrated
 * scores turned into "N days to go" claimed far more than it knew.
 *
 * Returns null below the trust guardrail (fewer than MIN_SESSIONS exams,
 * or fewer than MIN_DISTINCT_DAYS distinct calendar days).
 */
export function computeTrend(sessions: TrendSession[]): Trend | null {
  if (sessions.length < MIN_SESSIONS) return null;

  const sorted = [...sessions].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const distinctDays = new Set(sorted.map(s => s.completed_at.slice(0, 10)));
  if (distinctDays.size < MIN_DISTINCT_DAYS) return null;

  const firstMs = new Date(sorted[0].completed_at).getTime();
  const points = sorted.map(s => ({
    x: (new Date(s.completed_at).getTime() - firstMs) / MS_PER_DAY,
    y: s.score,
  }));

  const n = points.length;
  const xm = points.reduce((sum, p) => sum + p.x, 0) / n;
  const ym = points.reduce((sum, p) => sum + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - xm) * (p.y - ym);
    den += (p.x - xm) * (p.x - xm);
  }

  return { slopePerDay: den > 0 ? num / den : 0, currentScore: sorted[n - 1].score };
}
