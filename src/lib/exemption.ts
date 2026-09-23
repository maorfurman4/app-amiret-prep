import { thetaToScore } from '@/lib/adaptive';
import { exemptionProbability, standardError } from '@/lib/calibration';
import { isExperimentalSection, type Question, type SectionResult } from '@/types/exam';

/**
 * Presentation-side exemption math: one exam's measurement, several exams
 * pooled into a current estimate, and the score range the uncertainty
 * implies. Pure — the same functions the server uses at exam completion
 * (src/lib/calibration.ts), so a number shown here is the number stored.
 */

export interface Measurement {
  /** Ability estimate. */
  theta: number;
  /** Its standard error. */
  se: number;
  /** P(true θ ≥ cut). */
  p: number;
}

export interface SessionLike {
  theta_final?: number | null;
  theta_se?: number | null;
  p_exempt?: number | null;
  section_results?: unknown;
}

/**
 * One exam's measurement: stored θ̂ / SE / P(exempt) when the exam was
 * scored after they existed; otherwise re-derived from the exam's own
 * scored items, exactly as the server would have (exams before
 * 2026-09-23 predate the stored columns).
 */
export function sessionMeasurement(s: SessionLike): Measurement | null {
  const theta = s.theta_final;
  if (typeof theta !== 'number' || !Number.isFinite(theta)) return null;

  let se = typeof s.theta_se === 'number' && s.theta_se > 0 ? s.theta_se : NaN;
  if (!Number.isFinite(se)) {
    const scored = ((s.section_results ?? []) as SectionResult[])
      .filter(sr => !isExperimentalSection(sr.sectionIndex))
      .flatMap(sr => (sr.questions ?? []) as Question[]);
    se = standardError(theta, scored);
  }
  if (!Number.isFinite(se)) return null;

  const p = typeof s.p_exempt === 'number' ? s.p_exempt : exemptionProbability(theta, se);
  return { theta, se, p };
}

/** How many of the most recent exams make up the "current" estimate. */
export const POOL_WINDOW = 3;

/**
 * Precision-weighted pooling of several exams into one current estimate:
 * θ̄ = Σ(θᵢ/SEᵢ²) / Σ(1/SEᵢ²), SE = 1/√Σ(1/SEᵢ²). This assumes ability is
 * roughly constant across the pooled exams — which is why only the last
 * POOL_WINDOW are pooled: a student who is still improving shouldn't be
 * held back by where they were a month ago.
 */
export function pooledMeasurement(ms: Measurement[]): Measurement | null {
  const usable = ms.filter(m => Number.isFinite(m.theta) && Number.isFinite(m.se) && m.se > 0);
  if (usable.length === 0) return null;
  const weights = usable.map(m => 1 / (m.se * m.se));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const theta = usable.reduce((sum, m, i) => sum + m.theta * weights[i], 0) / totalWeight;
  const se = 1 / Math.sqrt(totalWeight);
  return { theta, se, p: exemptionProbability(theta, se) };
}

/**
 * An earlier exam counts as "clearly below" the latest when the gap exceeds
 * this many combined standard errors — a one-sided 95% test. Anything
 * closer is indistinguishable from measurement noise and is pooled.
 */
export const CONSISTENCY_Z = 1.645;

/**
 * Drops earlier exams that are clearly below the latest one, keeping the
 * latest and everything statistically consistent with it (or above it):
 *   drop i  ⇔  θ_latest − θ_i > CONSISTENCY_Z · √(SE_latest² + SE_i²)
 * Deliberately one-sided: a genuine breakthrough shows up immediately
 * instead of being dragged down by where the student used to be, while a
 * single weaker latest exam is still smoothed by the stronger ones before
 * it (learning moves forward; a bad day mostly doesn't mean forgetting).
 * `ms` is chronological; the last entry is the latest exam.
 */
export function consistentWithLatest(ms: Measurement[], z = CONSISTENCY_Z): Measurement[] {
  if (ms.length <= 1) return ms;
  const latest = ms[ms.length - 1];
  return ms.filter((m, i) =>
    i === ms.length - 1 || latest.theta - m.theta <= z * Math.sqrt(latest.se ** 2 + m.se ** 2));
}

export interface CurrentEstimate {
  measurement: Measurement;
  /** How many exams were pooled into it. */
  used: number;
  /** How many recent exams were left out as clearly below the latest. */
  dropped: number;
}

/**
 * The student's current standing: the last POOL_WINDOW exams, minus any
 * clearly below the latest, pooled by precision. `ms` is chronological.
 */
export function currentEstimate(ms: Measurement[]): CurrentEstimate | null {
  const recent = ms.slice(-POOL_WINDOW);
  const kept = consistentWithLatest(recent);
  const measurement = pooledMeasurement(kept);
  if (!measurement) return null;
  return { measurement, used: kept.length, dropped: recent.length - kept.length };
}

/** z for a central 80% interval — wide enough to be honest, narrow enough to be useful. */
export const INTERVAL_Z = 1.2816;

/** The score range θ̂ ± z·SE maps to (on the app's 50–150 scale). */
export function scoreInterval(m: Pick<Measurement, 'theta' | 'se'>, z = INTERVAL_Z): { lo: number; hi: number } {
  return { lo: thetaToScore(m.theta - z * m.se), hi: thetaToScore(m.theta + z * m.se) };
}

export type ExemptionTone = 'likely' | 'close' | 'building';

/** Visual tone of a probability: ≥70% likely, 30–70% a coin-flip zone, <30% still building. */
export function exemptionTone(p: number): ExemptionTone {
  if (p >= 0.7) return 'likely';
  if (p >= 0.3) return 'close';
  return 'building';
}

/** Whole-percent display that never claims certainty the model can't have. */
export function formatProbability(p: number): string {
  const pct = Math.round(p * 100);
  if (pct >= 100) return '>99%';
  if (pct <= 0) return '<1%';
  return `${pct}%`;
}
