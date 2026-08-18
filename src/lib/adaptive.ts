import type { DifficultyLevel, IrtParams, SectionResult } from '@/types/exam';

// ─── IRT 3PL Core ────────────────────────────────────────────────────────────

/**
 * P(θ) = c + (1-c) / (1 + e^(-a*(θ-b)))
 * Returns probability of correct answer given ability θ.
 */
export function irtProbability(theta: number, { a, b, c }: IrtParams): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

/**
 * Log-likelihood of observed response vector.
 * u=1 correct, u=0 incorrect.
 */
function logLikelihood(theta: number, items: IrtParams[], responses: number[]): number {
  let ll = 0;
  for (let i = 0; i < items.length; i++) {
    const p = irtProbability(theta, items[i]);
    const u = responses[i];
    ll += u * Math.log(Math.max(p, 1e-10)) + (1 - u) * Math.log(Math.max(1 - p, 1e-10));
  }
  return ll;
}

// ─── MLE (Newton-Raphson) ─────────────────────────────────────────────────────

/**
 * Estimate θ via MLE using Newton-Raphson.
 * Clamped to [-3, 3]. Handles perfect/zero score via EAP fallback.
 */
export function estimateThetaMLE(
  prevTheta: number,
  items: IrtParams[],
  responses: number[], // 1=correct, 0=incorrect
): number {
  const sumCorrect = responses.reduce((a, b) => a + b, 0);

  // Fallback to EAP when all correct or all wrong (MLE diverges to ±∞)
  if (sumCorrect === responses.length || sumCorrect === 0) {
    return estimateThetaEAP(items, responses);
  }

  let theta = prevTheta;
  const MAX_ITER = 50;
  const TOLERANCE = 1e-6;
  let lastDelta = Infinity;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let d1 = 0; // first derivative of log-likelihood
    let d2 = 0; // second derivative

    for (let i = 0; i < items.length; i++) {
      const { a, b, c } = items[i];
      const p = irtProbability(theta, { a, b, c });
      const u = responses[i];

      // w = (P - c) / (1 - c)  — the "discrimination weight"
      const w = (p - c) / Math.max(1 - c, 1e-10);
      const q = 1 - p;

      // d(log P)/dθ when u=1, d(log(1-P))/dθ when u=0
      const common = a * w * q;
      d1 += (u - p) * common / Math.max(p * q, 1e-10);
      d2 -= (common * common) / Math.max(p * q, 1e-10);
    }

    if (Math.abs(d2) < 1e-10) break;
    const delta = d1 / d2;
    theta -= delta;
    theta = Math.max(-3, Math.min(3, theta));
    lastDelta = delta;

    if (Math.abs(delta) < TOLERANCE) break;
  }

  theta = Math.max(-3, Math.min(3, theta));

  // Undamped Newton-Raphson can overshoot past ±3 on a low- (but not zero-)
  // scoring response set, get clamped back to the boundary, then recompute
  // the identical oversized step from that same point on every remaining
  // iteration — it never converges, it just returns the clamp value. That
  // silently produced a hard floor/ceiling score for response patterns far
  // short of "everything right" or "everything wrong". EAP has no such
  // failure mode (it's a bounded weighted average, not an iterative walk),
  // so fall back to it whenever the loop ends still at the boundary with a
  // meaningful residual step — i.e. it got stuck, not genuinely converged.
  if ((theta === -3 || theta === 3) && Math.abs(lastDelta) > TOLERANCE) {
    return estimateThetaEAP(items, responses);
  }

  return theta;
}

// ─── EAP (Expected A Posteriori) ─────────────────────────────────────────────

/**
 * EAP with N(0,1) prior — numerically integrates over [-3, 3].
 * Used as fallback when MLE would diverge (all correct / all wrong in first section).
 */
export function estimateThetaEAP(items: IrtParams[], responses: number[]): number {
  const POINTS = 41;
  const MIN = -3;
  const MAX = 3;
  const step = (MAX - MIN) / (POINTS - 1);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < POINTS; i++) {
    const t = MIN + i * step;
    const prior = Math.exp(-0.5 * t * t); // N(0,1) unnormalized
    let likelihood = 1;

    for (let j = 0; j < items.length; j++) {
      const p = irtProbability(t, items[j]);
      likelihood *= responses[j] === 1 ? p : 1 - p;
    }

    const weight = likelihood * prior;
    numerator += t * weight;
    denominator += weight;
  }

  if (denominator < 1e-15) return 0;
  return Math.max(-3, Math.min(3, numerator / denominator));
}

// ─── Section Routing ──────────────────────────────────────────────────────────

/**
 * Maps current θ estimate to difficulty level (1-5) for next section pool.
 * Targets P=0.5 — the most informative operating point.
 */
export function routeNextDifficulty(theta: number): DifficultyLevel {
  if (!isFinite(theta)) return 3;
  if (theta >= 1.5)  return 5;
  if (theta >= 0.5)  return 4;
  if (theta >= -0.5) return 3;
  if (theta >= -1.5) return 2;
  return 1;
}

// ─── Score Conversion ─────────────────────────────────────────────────────────

/**
 * Linear transformation: θ ∈ [-3, 3] → score ∈ [50, 150]
 * Score = θ * 20 + 100  (clamped to [50, 150])
 */
export function thetaToScore(theta: number): number {
  if (!isFinite(theta)) return 100;
  const raw = theta * 20 + 100;
  return Math.max(50, Math.min(150, Math.round(raw)));
}

// ─── Section-Level Update ─────────────────────────────────────────────────────

/**
 * After a section is completed, update theta.
 * Returns new theta (clamped ±3).
 */
export function updateThetaAfterSection(
  prevTheta: number,
  sectionResult: Pick<SectionResult, 'questions' | 'answers'>,
): number {
  const items: IrtParams[] = sectionResult.questions.map(q => ({
    a: q.a,
    b: q.b,
    c: q.c,
  }));

  const responses: number[] = sectionResult.answers.map((ans, i) => {
    if (ans === null) return 0; // unanswered = wrong
    return ans === sectionResult.questions[i].correct_answer ? 1 : 0;
  });

  return estimateThetaMLE(prevTheta, items, responses);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function correctCount(sectionResult: Pick<SectionResult, 'questions' | 'answers'>): number {
  return sectionResult.answers.reduce<number>((acc, ans, i) => {
    return acc + (ans === sectionResult.questions[i].correct_answer ? 1 : 0);
  }, 0);
}
