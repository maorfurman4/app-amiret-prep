/**
 * FSRS (Free Spaced Repetition Scheduler), version 4.5 — the memory model
 * behind the review queue. Pure functions only; persistence lives in
 * src/lib/srs.ts.
 *
 * Each card carries two numbers:
 *   stability  S — days until the probability of recall falls to 90%
 *   difficulty D — 1..10, how hard the concept is for this student
 * and probability of recall decays with *real elapsed time*:
 *   R(t, S) = (1 + FACTOR · t / S) ^ DECAY
 * so reviewing something a minute after seeing it (R ≈ 1) barely moves S,
 * while a successful review after it had half-faded grows S a lot. That is
 * the core fix over the old "double the interval on any correct answer".
 *
 * Weights are FSRS-4.5's published defaults, fitted on a large population
 * of flashcard reviews. They are priors: once the responses table holds
 * enough of our own review history they should be re-fitted for this app.
 */

export type Grade = 1 | 2 | 3 | 4;
export const Again: Grade = 1;
export const Hard: Grade = 2;
export const Good: Grade = 3;
export const Easy: Grade = 4;

export const FSRS_WEIGHTS = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;
const w = FSRS_WEIGHTS;

const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9 exactly

export const MS_PER_DAY = 86_400_000;

/** Default target probability of recall at review time. */
export const BASE_RETENTION = 0.9;
/** Target retention in the final stretch before the exam (see desiredRetention). */
export const EXAM_RETENTION = 0.95;
/** Days before the exam over which the target ramps from BASE to EXAM retention. */
export const EXAM_RAMP_DAYS = 14;

/** Interval bounds, in days. The floor keeps a just-failed item from
 * resurfacing within the same sitting; the ceiling keeps nothing out of
 * sight for longer than a prep period realistically lasts. */
export const MIN_INTERVAL_DAYS = 0.25;
export const MAX_INTERVAL_DAYS = 180;

export interface MemoryState {
  stability: number;
  difficulty: number;
}

export interface CardState extends MemoryState {
  reps: number;
  lapses: number;
  lastReviewAt: Date;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ── Core model ───────────────────────────────────────────────────────────────

export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Days until R falls to `retention`, for a card with stability S. */
export function intervalForRetention(stability: number, retention: number): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

function initialDifficulty(grade: Grade): number {
  return clamp(w[4] - (grade - 3) * w[5], 1, 10);
}

function nextDifficulty(d: number, grade: Grade): number {
  const moved = d - w[6] * (grade - 3);
  // Mean reversion toward the default difficulty keeps D from drifting to
  // the bounds after a streak of identical grades.
  return clamp(w[7] * initialDifficulty(Good) + (1 - w[7]) * moved, 1, 10);
}

function recallStability(d: number, s: number, r: number, grade: Grade): number {
  const hardPenalty = grade === Hard ? w[15] : 1;
  const easyBonus = grade === Easy ? w[16] : 1;
  return s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1);
}

function forgetStability(d: number, s: number, r: number): number {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  // Forgetting can never leave a memory *more* stable than before.
  return Math.min(sf, s);
}

/** State after the very first graded exposure to a concept. */
export function initialState(grade: Grade, now: Date): CardState {
  return {
    stability: w[grade - 1],
    difficulty: initialDifficulty(grade),
    reps: 1,
    lapses: grade === Again ? 1 : 0,
    lastReviewAt: now,
  };
}

/** Applies one graded review at time `now` to an existing card. */
export function reviewCard(card: CardState, grade: Grade, now: Date): CardState {
  const elapsedDays = Math.max(0, (now.getTime() - card.lastReviewAt.getTime()) / MS_PER_DAY);
  const r = retrievability(elapsedDays, card.stability);
  const stability = grade === Again
    ? forgetStability(card.difficulty, card.stability, r)
    : recallStability(card.difficulty, card.stability, r, grade);
  return {
    stability: Math.max(stability, 0.01),
    difficulty: nextDifficulty(card.difficulty, grade),
    reps: card.reps + 1,
    lapses: card.lapses + (grade === Again ? 1 : 0),
    lastReviewAt: now,
  };
}

// ── Exam awareness ───────────────────────────────────────────────────────────

/**
 * An exam date is a calendar day; the exam itself is treated as starting
 * at 06:00 UTC that day (08:00–09:00 in Israel) — a morning sitting.
 */
export function examInstant(examDate: string | null | undefined): Date | null {
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return null;
  const at = new Date(`${examDate}T06:00:00.000Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Target retention rises from 90% to 95% over the last two weeks: as the
 * exam approaches, reviews come sooner (at higher R), trading efficiency
 * for certainty exactly when certainty is what's being tested.
 */
export function desiredRetention(now: Date, examAt: Date | null): number {
  if (!examAt) return BASE_RETENTION;
  const daysLeft = (examAt.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysLeft <= 0 || daysLeft >= EXAM_RAMP_DAYS) return BASE_RETENTION;
  return BASE_RETENTION + (EXAM_RETENTION - BASE_RETENTION) * (1 - daysLeft / EXAM_RAMP_DAYS);
}

/**
 * Pulls a due date that would land past the pre-exam peak window back into
 * it, so an item's last scheduled review before the test falls 1–3 days out
 * (aiming for 2) and its retrievability peaks on exam day. Due dates
 * already before the window are left alone. The final 24 hours are kept
 * free of scheduled reviews: a card reviewed inside them is held until the
 * exam itself rather than brought back the night before. After the exam,
 * nothing is capped.
 */
export function capDueToExam(due: Date, now: Date, examAt: Date | null): Date {
  if (!examAt || examAt.getTime() <= now.getTime()) return due;
  const latest = examAt.getTime() - 1 * MS_PER_DAY;
  if (due.getTime() <= latest) return due;
  if (latest <= now.getTime()) {
    // Less than a day to go: hold until the exam — never past it, and
    // never another scheduled review the night before.
    return new Date(examAt.getTime());
  }
  const target = examAt.getTime() - 2 * MS_PER_DAY;
  const earliest = now.getTime() + MIN_INTERVAL_DAYS * MS_PER_DAY;
  return new Date(Math.min(latest, Math.max(target, earliest)));
}

/** Next due date for a card that was just reviewed at `now`. */
export function scheduleDue(stability: number, now: Date, examAt: Date | null): Date {
  const interval = clamp(intervalForRetention(stability, desiredRetention(now, examAt)), MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS);
  return capDueToExam(new Date(now.getTime() + interval * MS_PER_DAY), now, examAt);
}

// ── Implicit grading ─────────────────────────────────────────────────────────

/** Per-question time budget in the real exam (seconds): SC 4 min / 4,
 * restatement 6 min / 3, reading 15 min / 5. */
export const TIME_BUDGET_SECONDS: Record<string, number> = {
  sentence_completion: 60,
  restatement: 120,
  reading_comprehension: 180,
};
const DEFAULT_BUDGET_SECONDS = 90;

/** Correct in under this share of the budget → fluent (Easy). */
export const EASY_SHARE = 1 / 3;
/** Correct in under this share of the budget → too fast to have read the
 * item; likely a guess, so it counts as weak evidence (Hard). */
export const RAPID_GUESS_SHARE = 0.05;

export interface GradeInput {
  correct: boolean;
  latencyMs: number | null | undefined;
  type: string;
  /** Self-reported 1 (guess) .. 3 (sure), when the surface asked. */
  confidence?: number | null;
}

/**
 * Derives an FSRS grade from a multiple-choice response — there is no
 * "how well did you know it" button, so speed stands in for fluency:
 *   wrong                               → Again
 *   correct, implausibly fast           → Hard  (probable guess)
 *   correct, within a third of budget   → Easy
 *   correct, within budget              → Good
 *   correct, over budget                → Hard  (knew it, but not fluently)
 *   correct, no latency recorded        → Good
 * Self-reported confidence can only lower the grade: "guessed" caps at
 * Hard, "unsure" caps at Good.
 */
export function gradeResponse({ correct, latencyMs, type, confidence }: GradeInput): Grade {
  if (!correct) return Again;
  let grade: Grade = Good;
  if (typeof latencyMs === 'number' && Number.isFinite(latencyMs) && latencyMs >= 0) {
    const budgetMs = (TIME_BUDGET_SECONDS[type] ?? DEFAULT_BUDGET_SECONDS) * 1000;
    if (latencyMs < budgetMs * RAPID_GUESS_SHARE) grade = Hard;
    else if (latencyMs <= budgetMs * EASY_SHARE) grade = Easy;
    else if (latencyMs <= budgetMs) grade = Good;
    else grade = Hard;
  }
  if (confidence === 1) grade = Math.min(grade, Hard) as Grade;
  else if (confidence === 2) grade = Math.min(grade, Good) as Grade;
  return grade;
}
