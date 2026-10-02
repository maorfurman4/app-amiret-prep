import { BASELINE_C } from '@/lib/adaptive';
import { RAPID_GUESS_SHARE, TIME_BUDGET_SECONDS } from '@/lib/fsrs';
import { isExperimentalSection, type SectionResult } from '@/types/exam';

/**
 * Response-time effort (Wise & Kong, 2005): was an exam actually attempted,
 * or clicked through? An answer given in under RAPID_GUESS_SHARE of its
 * type's time budget is a rapid guess — too fast to have read the item.
 *
 * Speed alone never invalidates an exam: a fast student who is also right
 * is fluent, not guessing, and keeps their score. An exam is flagged only
 * when BOTH hold:
 *  - most of its answered scored items were rapid guesses, and
 *  - its accuracy is not significantly above the 4-option guessing rate
 *    (one-sided exact binomial test at α = 0.05 against BASELINE_C).
 * That is, the answers are indistinguishable from random clicking, so the
 * score describes the clicking, not the student. Such an exam still shows
 * its score, but is left out of every ability estimate built on top of it
 * (the stats headline score, readiness, trend, the official-score prediction).
 */

/** Answered faster than this share of the time budget → almost certainly a
 * guess: it says nothing about the student or the item. */
export function isRapidGuess(type: string, latencyMs: number | null): boolean {
  if (latencyMs === null || !Number.isFinite(latencyMs)) return false;
  return latencyMs < (TIME_BUDGET_SECONDS[type] ?? 90) * 1000 * RAPID_GUESS_SHARE;
}

/** Significance level of the "better than guessing" test. */
export const CHANCE_TEST_ALPHA = 0.05;

/** P(X ≥ k) for X ~ Binomial(n, p) — exact, fine for exam-sized n. */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let term = (1 - p) ** n; // P(X = 0)
  let below = 0;
  for (let i = 0; i < k; i++) {
    below += term;
    term *= ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return Math.max(0, 1 - below);
}

export interface ExamEffort {
  /** Answered scored items (blanks are never guesses — they're blanks). */
  answered: number;
  /** Of those, how many have a recorded time at all. */
  timed: number;
  rapid: number;
  correct: number;
  /** Most answers were rapid guesses and accuracy is consistent with chance. */
  lowEffort: boolean;
}

type EffortSection = Pick<SectionResult, 'sectionIndex' | 'type' | 'answers' | 'correctCount'> & { timings?: number[] };

/**
 * Effort over an exam's scored sections (the experimental one never counts,
 * same as the score). Timings are the per-question seconds the exam stores
 * in section_results; exams from before timings were recorded have none and
 * are never flagged.
 */
export function examEffort(sectionResults: unknown): ExamEffort {
  const sections = (Array.isArray(sectionResults) ? sectionResults : []) as EffortSection[];
  let answered = 0, timed = 0, rapid = 0, correct = 0;
  for (const sr of sections) {
    if (!sr || isExperimentalSection(sr.sectionIndex)) continue;
    const answers = Array.isArray(sr.answers) ? sr.answers : [];
    correct += sr.correctCount ?? 0;
    answers.forEach((ans, i) => {
      if (ans === null || ans === undefined) return;
      answered++;
      const t = sr.timings?.[i];
      if (typeof t !== 'number' || !Number.isFinite(t)) return;
      timed++;
      if (isRapidGuess(sr.type, t * 1000)) rapid++;
    });
  }
  const mostlyRapid = answered > 0 && rapid * 2 > answered;
  const aboveChance = binomialUpperTail(correct, answered, BASELINE_C) < CHANCE_TEST_ALPHA;
  return { answered, timed, rapid, correct, lowEffort: mostlyRapid && !aboveChance };
}

export function isLowEffortExam(sectionResults: unknown): boolean {
  return examEffort(sectionResults).lowEffort;
}
