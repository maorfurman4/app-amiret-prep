/**
 * Practice-mode exam rules that survive a reload.
 *
 * In practice mode a question locks once answered (its explanation is shown
 * right away). The lock lived only in memory, so after a refresh every
 * restored answer could be changed again — after seeing the solution.
 */
export function lockedFromAnswers(answers: (number | null)[]): Set<number> {
  const locked = new Set<number>();
  answers.forEach((a, i) => { if (a !== null && a !== undefined) locked.add(i); });
  return locked;
}

/**
 * Pace analysis compares time spent with each section's time budget — it
 * only means something for a timed exam. A practice run has no timer, so
 * "used X of 240 seconds" and "over the stuck budget, better to guess" were
 * advice about a clock that wasn't there.
 */
export function showPaceAnalysis(isPractice: boolean, sectionResults: { timings?: number[] | null }[]): boolean {
  return !isPractice && sectionResults.some(sr => !!sr.timings && sr.timings.length > 0);
}
