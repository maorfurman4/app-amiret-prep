export interface ForecastSession {
  score: number;
  completed_at: string;
}

export interface Forecast {
  /** Least-squares points/day over completed_at deltas — calendar-day
   * velocity, not points-per-exam (see module doc below for why). */
  slopePerDay: number;
  /** ISO date (YYYY-MM-DD) the regression line crosses targetScore, or
   * null if the trend isn't improving fast enough to project one. */
  projectedDate: string | null;
  daysToTarget: number | null;
  currentScore: number;
}

const MS_PER_DAY = 86_400_000;

/** Below this, a trend line is fit to noise, not signal. */
const MIN_SESSIONS = 4;
const MIN_DISTINCT_DAYS = 3;

/** A slope below this reads as "flat" — not worth projecting a fake date. */
const MIN_MEANINGFUL_SLOPE = 0.01;

/**
 * Calendar-day-based score forecast for the Victory Path. Velocity is
 * points-per-*day* (using real date deltas between completed_at
 * timestamps), not points-per-exam — someone who takes 5 exams in one
 * afternoon hasn't actually improved their trajectory 5x, so an
 * exams-based slope would overstate their progress. This is the same
 * data /stats's older "exams to reach 134" tracker used, just regressed
 * against elapsed days instead of exam index.
 *
 * Returns null below the trust guardrail (fewer than MIN_SESSIONS exams,
 * or fewer than MIN_DISTINCT_DAYS distinct calendar days) — a forecast
 * from three exams taken in one sitting is noise, not a prediction, and a
 * professional tool should say so rather than guess.
 */
export function computeForecast(sessions: ForecastSession[], targetScore: number): Forecast | null {
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
  const slope = den > 0 ? num / den : 0;
  const intercept = ym - slope * xm;

  const currentScore = sorted[sorted.length - 1].score;

  if (currentScore >= targetScore) {
    return { slopePerDay: slope, projectedDate: null, daysToTarget: 0, currentScore };
  }
  if (slope < MIN_MEANINGFUL_SLOPE) {
    return { slopePerDay: slope, projectedDate: null, daysToTarget: null, currentScore };
  }

  const lastX = points[n - 1].x;
  const estimateAtLastX = intercept + slope * lastX;
  const daysToTarget = Math.max(1, Math.ceil((targetScore - estimateAtLastX) / slope));
  const projectedDate = new Date(firstMs + (lastX + daysToTarget) * MS_PER_DAY).toISOString().slice(0, 10);

  return { slopePerDay: slope, projectedDate, daysToTarget, currentScore };
}
