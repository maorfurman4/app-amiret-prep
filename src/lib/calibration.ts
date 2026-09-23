import { BASELINE_A, itemIrtParams } from '@/lib/adaptive';

/**
 * Data-driven measurement: item calibration (Elo), information-based item
 * selection, cut-score targeting, and the exemption probability.
 *
 * Scale note (read before trusting "134"): items are calibrated against the
 * app's own ability scale — θ = 0 is roughly this app's average student,
 * because every ability estimate uses an N(0,1) prior. The score mapping
 * θ·20 + 100 (so 134 ↔ θ = 1.7) is still an assumption until app scores are
 * linked to officially reported NITE scores. Everything below makes the
 * *measurement* real and quantifies its uncertainty; linking makes the
 * *scale* real.
 */

// ── Cut score ────────────────────────────────────────────────────────────────

export const EXEMPTION_SCORE = 134;
/** θ at the exemption cut under the current θ·20+100 score mapping. */
export const CUT_THETA = (EXEMPTION_SCORE - 100) / 20; // 1.7

// ── Fisher information ───────────────────────────────────────────────────────

type ItemLike = { b: number; c?: number | null; b_calibrated?: number | null };

/**
 * 3PL item information: I(θ) = a² · (Q/P) · ((P − c)/(1 − c))².
 * With a guessing floor, an item is most informative slightly *above* its
 * difficulty: at θ = b + ln((1 + √(1 + 8c)) / 2) / a (≈ b + 0.26 for
 * a = 1.2, c = 0.25) — equivalently, the best item for a student at θ has
 * b ≈ θ − 0.26.
 */
export function fisherInformation(theta: number, item: ItemLike): number {
  const { a, b, c } = itemIrtParams(item);
  const p = c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
  const q = 1 - p;
  return a * a * (q / p) * ((p - c) / (1 - c)) ** 2;
}

export function testInformation(theta: number, items: ItemLike[]): number {
  return items.reduce((sum, item) => sum + fisherInformation(theta, item), 0);
}

/** Standard error of a θ estimate from the items it rests on. */
export function standardError(theta: number, items: ItemLike[]): number {
  const info = testInformation(theta, items);
  return info > 0 ? 1 / Math.sqrt(info) : Infinity;
}

// ── Routing target ───────────────────────────────────────────────────────────

/** Sections from here on are decision sections: 5 and 6 are the last scored
 * sections, 7 the experimental one (which can still raise the score). */
export const CUT_TARGET_FROM_SECTION = 5;
/** The cut is "in play" while it lies within this many SEs of θ̂. */
export const CUT_BAND_SE = 2;

export interface RouteTarget {
  theta: number;
  reason: 'ability' | 'cut_score';
}

/**
 * Where to aim the next section's information.
 *
 * Early sections aim at the current ability estimate — the fastest way to
 * locate the student. Decision sections aim at the cut score instead, but
 * only while the pass/fail decision is still genuinely uncertain (the cut
 * is within CUT_BAND_SE standard errors of θ̂): for a student far from 134
 * either way, items at the cut would tell us almost nothing about them, so
 * we keep measuring where they actually are. This is the classification-CAT
 * rule (Eggen, 1999) — maximize information where the decision is made.
 */
export function chooseRouteTarget({ nextSectionIndex, theta, se }: { nextSectionIndex: number; theta: number; se: number }): RouteTarget {
  if (nextSectionIndex >= CUT_TARGET_FROM_SECTION && Math.abs(theta - CUT_THETA) <= CUT_BAND_SE * se) {
    return { theta: CUT_THETA, reason: 'cut_score' };
  }
  return { theta, reason: 'ability' };
}

// ── Exemption probability ────────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 erf; |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * P(true θ ≥ cut | θ̂, SE) under the normal approximation to the estimate's
 * sampling distribution — the probability the student is at or above the
 * exemption cut, on this app's scale (see the scale note at the top).
 */
export function exemptionProbability(theta: number, se: number): number {
  if (!Number.isFinite(se) || se <= 0) return theta >= CUT_THETA ? 1 : 0;
  return normalCdf((theta - CUT_THETA) / se);
}

// ── Elo item calibration (Pelánek, 2016) ─────────────────────────────────────

/** Initial step size and its decay: K(n) = K0 / (1 + n / N0). Early answers
 * move a fresh item quickly; a well-measured item barely moves. */
export const ELO_K0 = 0.4;
export const ELO_N0 = 20;
/** Calibrated difficulty stays within this band. */
export const B_BOUND = 4;
/** A student's answers only calibrate items once their own ability rests on
 * at least this many answers — an unknown θ would just add noise. */
export const MIN_CALIBRATION_HISTORY = 10;

/**
 * One Elo update of an item's difficulty after one answer:
 *   b ← b + K(n) · (P(correct | θ, b) − outcome)
 * A student who does worse than the model predicted makes the item look
 * harder (b rises), better than predicted makes it easier. Mirrored exactly
 * by public.calibrate_from_responses (the SQL that applies it atomically).
 */
export function eloStep(
  b: number,
  n: number,
  theta: number,
  correct: boolean,
  { a = BASELINE_A, c = 0.25, k0 = ELO_K0, n0 = ELO_N0 }: { a?: number; c?: number; k0?: number; n0?: number } = {},
): number {
  const p = c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
  const k = k0 / (1 + n / n0);
  const next = b + k * (p - (correct ? 1 : 0));
  return Math.max(-B_BOUND, Math.min(B_BOUND, next));
}
